import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  ErrorValidacionPasada,
  Factura,
  Pasada,
  PasadaEstandarizada,
  RegistroCargaPeajes,
} from '../models/peajes.models';
import {
  ConfirmacionCargaInput,
  ConfirmacionCargaResultado,
  PeajesCargaService,
  ResultadoValidacionCarga,
} from '../models/peajes-services.contracts';
import { SupabaseService } from '../../../services/supabase.service';

@Injectable({ providedIn: 'root' })
export class PeajesCargaSupabaseService implements PeajesCargaService {
  private readonly supabase = inject(SupabaseService);

  validarCarga(
    pasadas: PasadaEstandarizada[],
    factura: Pick<Factura, 'importe_sin_iva' | 'percepciones' | 'iva' | 'importe_total'>
  ): Observable<ResultadoValidacionCarga> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const errores: ErrorValidacionPasada[] = [];
        const validas: PasadaEstandarizada[] = [];
        const importes: number[] = [];

        for (let idx = 0; idx < pasadas.length; idx++) {
          const p = pasadas[idx];
          const fila = idx + 1;
          const precio = Number(p.PRECIO);
          const bonif = Number(p.BONIFICACION ?? 0);
          if (Number.isNaN(precio) || precio < 0) {
            errores.push({ fila, columna: 'PRECIO', valor: p.PRECIO, motivo: 'PRECIO inválido (RN-08)' });
            continue;
          }
          if (Number.isNaN(bonif) || bonif < 0 || bonif > precio) {
            errores.push({
              fila,
              columna: 'BONIFICACION',
              valor: p.BONIFICACION,
              motivo: 'BONIFICACION inválida (RN-09)',
            });
            continue;
          }

          // RN-10 es una resta determinística. Antes se hacía un RPC por cada
          // fila, lo cual producía cientos de requests idénticos en cargas grandes.
          const netoCalculado = precio - bonif;
          const declarado = p.IMPORTE_NETO != null ? Number(p.IMPORTE_NETO) : null;
          // AUSOL entrega el neto ya bonificado. La consistencia que autoriza
          // la carga es el subtotal total de la factura (± $5), no exigir que
          // cada fila replique PRECIO - BONIFICACION.
          const neto = declarado !== null && Number.isFinite(declarado) ? declarado : netoCalculado;
          importes.push(neto);
          validas.push({ ...p, IMPORTE_NETO: neto });
        }

        const { data: validacion, error: valErr } = await client.rpc('peajes_validar_factura_pasadas', {
          p_importe_sin_iva: factura.importe_sin_iva,
          p_importes_neto: importes,
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
          fecha_hora: p.FECHA_HORA,
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
        const pasadasPayload = input.pasadas.map((p) => ({
          fecha_hora: p.FECHA_HORA,
          pase_id: p.PASE_ID,
          patente_id: p.PATENTE_ID,
          estacion_id: p.ESTACION_ID,
          precio: Number(p.PRECIO),
          bonificacion: Number(p.BONIFICACION ?? 0),
          quantity: Number(p.QUANTITY ?? 1),
          importe_neto: p.IMPORTE_NETO != null ? Number(p.IMPORTE_NETO) : undefined,
        }));

        const nombreArchivo =
          input.nombreArchivo ??
          (typeof input.parametrosEfectivos?.['archivo'] === 'string'
            ? (input.parametrosEfectivos['archivo'] as string)
            : null);

        const { data, error } = await client.rpc('peajes_confirmar_carga', {
          p_factura: input.factura,
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

        const facturaId = data.factura_id as string;
        const registroId = data.registro_id as string;
        const pasadaIds = (data.pasada_ids ?? []) as string[];

        const { data: factura, error: fErr } = await client
          .from('facturas')
          .select('*')
          .eq('id', facturaId)
          .single();
        if (fErr) throw fErr;

        const { data: pasadas, error: pErr } = await client
          .from('pasadas')
          .select('*')
          .in('id', pasadaIds.length ? pasadaIds : ['00000000-0000-0000-0000-000000000000']);
        if (pErr) throw pErr;

        const { data: registro, error: rErr } = await client
          .from('registros_carga_peajes')
          .select('*')
          .eq('id', registroId)
          .single();
        if (rErr) throw rErr;

        return {
          factura: factura as Factura,
          pasadas: (pasadas ?? []) as Pasada[],
          registro: registro as RegistroCargaPeajes,
        };
      })
    );
  }
}
