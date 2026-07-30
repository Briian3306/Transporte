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
    factura: Pick<Factura, 'importe_sin_iva' | 'importe_total'>
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

          const { data: neto, error } = await client.rpc('peajes_calcular_importe_neto', {
            p_precio: precio,
            p_bonificacion: bonif,
          });
          if (error) throw error;

          const declarado = p.IMPORTE_NETO != null ? Number(p.IMPORTE_NETO) : null;
          if (declarado != null && !Number.isNaN(declarado) && Math.abs(declarado - Number(neto)) > 0.01) {
            errores.push({
              fila,
              columna: 'IMPORTE_NETO',
              valor: declarado,
              motivo: `Difiere del calculado ${neto} (RN-11)`,
            });
            continue;
          }

          importes.push(Number(neto));
          validas.push({ ...p, IMPORTE_NETO: Number(neto) });
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
