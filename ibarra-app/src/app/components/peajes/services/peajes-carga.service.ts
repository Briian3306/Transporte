import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  Documento,
  ErrorValidacionPasada,
  Pasada,
  PasadaEstandarizada,
  RegistroCargaPeajes,
  normalizarImportesDocumento,
  normalizarImportesPasada,
} from '../models';
import {
  ConfirmacionCargaInput,
  ConfirmacionCargaResultado,
  PeajesCargaService,
  ResultadoValidacionCarga,
} from '../models/peajes-services.contracts';
import { SupabaseService } from '../../../services/supabase.service';
import { toPostgresFechaHora } from '../wizard/services/peajes-fecha.util';

@Injectable({ providedIn: 'root' })
export class PeajesCargaSupabaseService implements PeajesCargaService {
  private readonly supabase = inject(SupabaseService);

  validarCarga(
    pasadas: PasadaEstandarizada[],
    documento: Pick<
      Documento,
      'tipo' | 'importe_sin_iva' | 'bonificacion' | 'percepciones' | 'iva' | 'importe_total'
    >
  ): Observable<ResultadoValidacionCarga> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const errores: ErrorValidacionPasada[] = [];
        const validas: PasadaEstandarizada[] = [];
        const importes: number[] = [];
        const tipo = documento.tipo ?? 'FC';

        for (let idx = 0; idx < pasadas.length; idx++) {
          const p = pasadas[idx];
          const fila = idx + 1;
          const precioRaw = Number(p.PRECIO);
          const bonifRaw = Number(p.BONIFICACION ?? 0);
          if (Number.isNaN(precioRaw)) {
            errores.push({ fila, columna: 'PRECIO', valor: p.PRECIO, motivo: 'PRECIO inválido (RN-08)' });
            continue;
          }
          if (Number.isNaN(bonifRaw) || Math.abs(bonifRaw) > Math.abs(precioRaw)) {
            errores.push({
              fila,
              columna: 'BONIFICACION',
              valor: p.BONIFICACION,
              motivo: 'BONIFICACION inválida (RN-09)',
            });
            continue;
          }

          const norm = normalizarImportesPasada(tipo, {
            precio: precioRaw,
            bonificacion: bonifRaw,
            importe_neto:
              p.IMPORTE_NETO != null && Number.isFinite(Number(p.IMPORTE_NETO))
                ? Number(p.IMPORTE_NETO)
                : undefined,
          });

          importes.push(norm.importe_neto);
          validas.push({
            ...p,
            PRECIO: norm.precio,
            BONIFICACION: norm.bonificacion,
            IMPORTE_NETO: norm.importe_neto,
          });
        }

        const header = normalizarImportesDocumento(tipo, {
          importe_sin_iva: documento.importe_sin_iva,
          bonificacion: documento.bonificacion ?? 0,
          percepciones: documento.percepciones,
          iva: documento.iva,
          importe_total: documento.importe_total,
        });

        const { data: validacion, error: valErr } = await client.rpc('peajes_validar_factura_pasadas', {
          p_importe_sin_iva: header.importe_sin_iva,
          p_importes_neto: importes,
          p_bonificacion: header.bonificacion,
        });
        if (valErr) throw valErr;

        const dentro = Boolean(validacion?.dentro_tolerancia ?? validacion?.valido);
        return {
          validas,
          errores,
          diferenciaFactura: validacion?.diferencia ?? null,
          dentroTolerancia: dentro,
        } satisfies ResultadoValidacionCarga;
      })
    );
  }

  detectarDuplicados(pasadas: PasadaEstandarizada[]): Observable<ErrorValidacionPasada[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const payload = pasadas.map((p) => ({
          pase_id: p.PASE_ID,
          patente_id: p.PATENTE_ID,
          estacion_id: p.ESTACION_ID,
          fecha_hora: toPostgresFechaHora(p.FECHA_HORA) ?? p.FECHA_HORA,
        }));
        const { data, error } = await client.rpc('peajes_detectar_duplicados', {
          p_pasadas: payload,
        });
        if (error) throw error;
        return (data ?? []) as ErrorValidacionPasada[];
      })
    );
  }

  confirmarCarga(input: ConfirmacionCargaInput): Observable<ConfirmacionCargaResultado> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const tipo = input.documento.tipo ?? 'FC';
        const pasadasPayload = input.pasadas.map((p) => {
          const norm = normalizarImportesPasada(tipo, {
            precio: Number(p.PRECIO),
            bonificacion: Number(p.BONIFICACION ?? 0),
            importe_neto: p.IMPORTE_NETO != null ? Number(p.IMPORTE_NETO) : undefined,
          });
          return {
            fecha_hora: toPostgresFechaHora(p.FECHA_HORA) ?? p.FECHA_HORA,
            pase_id: p.PASE_ID,
            patente_id: p.PATENTE_ID,
            estacion_id: p.ESTACION_ID,
            precio: norm.precio,
            bonificacion: norm.bonificacion,
            quantity: Number(p.QUANTITY ?? 1),
            importe_neto: norm.importe_neto,
          };
        });

        const nombreArchivo =
          input.nombreArchivo ??
          (typeof input.parametrosEfectivos?.['archivo'] === 'string'
            ? (input.parametrosEfectivos['archivo'] as string)
            : null);

        const { data, error } = await client.rpc('peajes_confirmar_carga', {
          p_factura: {
            ...input.documento,
            tipo,
          },
          p_pasadas: pasadasPayload,
          p_plantilla_id: input.plantillaId ?? null,
          p_parametros_efectivos: {
            ...(input.parametrosEfectivos ?? {}),
            mapeos: input.mapeos,
            relaciones_estacion: input.relacionesEstacion,
          },
          p_algoritmos_efectivos: [],
          p_errores: [],
          p_nombre_archivo: nombreArchivo,
        });
        if (error) throw error;

        const documentoId = (data.documento_id ?? data.factura_id) as string;
        const registroId = data.registro_id as string;
        const pasadaIds = (data.pasada_ids ?? []) as string[];
        if (!documentoId || !registroId || pasadaIds.length !== pasadasPayload.length) {
          throw new Error('Respuesta incompleta de peajes_confirmar_carga');
        }

        // El RPC ya confirmó y cerró la transacción. No hacer SELECTs posteriores:
        // un fallo de red/cache en la hidratación convertiría un commit exitoso en
        // un falso error y permitiría que el usuario intente importar duplicados.
        const documento: Documento = {
          ...input.documento,
          ...normalizarImportesDocumento(tipo, input.documento),
          id: documentoId,
          tipo,
        };
        const pasadas: Pasada[] = pasadasPayload.map((p, index) => ({
          id: pasadaIds[index],
          fecha_hora: String(p.fecha_hora ?? ''),
          pase_id: String(p.pase_id ?? ''),
          patente_id: String(p.patente_id ?? ''),
          estacion_id: String(p.estacion_id ?? ''),
          documento_id: documentoId,
          precio: p.precio,
          bonificacion: p.bonificacion,
          quantity: p.quantity,
          importe_neto: p.importe_neto,
          file_upload_name: nombreArchivo,
        }));
        const registro: RegistroCargaPeajes = {
          id: registroId,
          plantilla_id: input.plantillaId ?? null,
          documento_id: documentoId,
          parametros_efectivos: {
            ...(input.parametrosEfectivos ?? {}),
            mapeos: input.mapeos,
            relaciones_estacion: input.relacionesEstacion,
          },
          filas_procesadas: pasadas.length,
          errores: [],
          nombre_archivo: nombreArchivo,
        };

        return {
          documento,
          pasadas,
          registro,
        };
      })
    );
  }
}
