import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  ConfirmacionCargaInput,
  ConfirmacionCargaResultado,
  ErrorValidacionPasada,
  Factura,
  Pasada,
  PasadaEstandarizada,
  PeajesCargaService,
  ResultadoValidacionCarga,
} from '../../models';

const TOLERANCIA_FACTURA = 0.01;

/**
 * Mock tipado de PeajesCargaService.
 * Validación/persistencia real: agente 01 (F01-2/5/6/9).
 */
@Injectable()
export class PeajesCargaMockService implements PeajesCargaService {
  validarCarga(
    pasadas: PasadaEstandarizada[],
    factura: Pick<Factura, 'importe_sin_iva' | 'importe_total'>
  ): Observable<ResultadoValidacionCarga> {
    const errores: ErrorValidacionPasada[] = [];
    const validas: PasadaEstandarizada[] = [];

    pasadas.forEach((pasada, index) => {
      const fila = index + 1;
      const required: Array<keyof PasadaEstandarizada> = [
        'FECHA_HORA',
        'PASE_ID',
        'PATENTE_ID',
        'ESTACION_ID',
        'PRECIO',
        'BONIFICACION',
        'QUANTITY',
        'IMPORTE_NETO',
      ];

      let ok = true;
      for (const col of required) {
        const valor = pasada[col];
        if (valor === null || valor === undefined || valor === '') {
          errores.push({
            fila,
            columna: String(col),
            valor,
            motivo: 'Campo obligatorio vacío',
          });
          ok = false;
        }
      }

      const precio = Number(pasada.PRECIO);
      const bonif = Number(pasada.BONIFICACION);
      const qty = Number(pasada.QUANTITY);
      const neto = Number(pasada.IMPORTE_NETO);

      if (Number.isFinite(precio) && precio < 0) {
        errores.push({ fila, columna: 'PRECIO', valor: precio, motivo: 'Importe negativo' });
        ok = false;
      }
      if (Number.isFinite(qty) && qty <= 0) {
        errores.push({ fila, columna: 'QUANTITY', valor: qty, motivo: 'Cantidad inválida' });
        ok = false;
      }
      if (Number.isFinite(neto) && Number.isFinite(precio) && Number.isFinite(bonif)) {
        const esperado = (precio - bonif) * (Number.isFinite(qty) && qty > 0 ? qty : 1);
        if (Math.abs(esperado - neto) > TOLERANCIA_FACTURA) {
          errores.push({
            fila,
            columna: 'IMPORTE_NETO',
            valor: neto,
            motivo: `No coincide con (PRECIO - BONIFICACION) * QUANTITY (= ${esperado})`,
          });
          ok = false;
        }
      }

      if (!pasada.PATENTE_ID) {
        errores.push({
          fila,
          columna: 'PATENTE_ID',
          valor: pasada.PATENTE_ID,
          motivo: 'Patente vacía',
        });
        ok = false;
      }

      if (ok) {
        validas.push(pasada);
      }
    });

    const sumaNetos = validas.reduce((acc, p) => acc + Number(p.IMPORTE_NETO || 0), 0);
    const diferenciaFactura = Number(factura.importe_sin_iva) - sumaNetos;
    const dentroTolerancia = Math.abs(diferenciaFactura) <= TOLERANCIA_FACTURA;

    if (!dentroTolerancia) {
      errores.push({
        fila: 0,
        columna: 'FACTURA.importe_sin_iva',
        valor: factura.importe_sin_iva,
        motivo: `Diferencia factura vs suma pasadas: ${diferenciaFactura.toFixed(2)} (tolerancia ${TOLERANCIA_FACTURA})`,
      });
    }

    return of({ validas, errores, diferenciaFactura, dentroTolerancia });
  }

  detectarDuplicados(pasadas: PasadaEstandarizada[]): Observable<ErrorValidacionPasada[]> {
    const seen = new Map<string, number>();
    const errores: ErrorValidacionPasada[] = [];

    pasadas.forEach((p, index) => {
      const key = [p.PASE_ID, p.FECHA_HORA, p.ESTACION_ID, p.PATENTE_ID].join('|');
      const prev = seen.get(key);
      if (prev !== undefined) {
        errores.push({
          fila: index + 1,
          columna: 'PASE_ID+FECHA_HORA+ESTACION_ID+PATENTE_ID',
          valor: key,
          motivo: `Duplicado de la fila ${prev}`,
        });
      } else {
        seen.set(key, index + 1);
      }
    });

    return of(errores);
  }

  confirmarCarga(input: ConfirmacionCargaInput): Observable<ConfirmacionCargaResultado> {
    const facturaId = input.factura.id ?? `FAC-${Date.now()}`;
    const factura: Factura = {
      ...input.factura,
      id: facturaId,
      created_at: new Date().toISOString(),
    };

    const nombreArchivo =
      input.nombreArchivo ??
      (typeof input.parametrosEfectivos?.['archivo'] === 'string'
        ? (input.parametrosEfectivos['archivo'] as string)
        : null);

    const pasadas: Pasada[] = input.pasadas.map((p, i) => ({
      id: `PSD-${i + 1}`,
      fecha_hora: String(p.FECHA_HORA ?? ''),
      pase_id: String(p.PASE_ID ?? ''),
      patente_id: String(p.PATENTE_ID ?? ''),
      estacion_id: String(p.ESTACION_ID ?? ''),
      factura_id: facturaId,
      precio: Number(p.PRECIO ?? 0),
      bonificacion: Number(p.BONIFICACION ?? 0),
      quantity: Number(p.QUANTITY ?? 1),
      importe_neto: Number(p.IMPORTE_NETO ?? 0),
      created_at: new Date().toISOString(),
      user_id: 'mock-user',
      file_upload_name: nombreArchivo,
    }));

    return of({
      factura,
      pasadas,
      registro: {
        id: `REG-${Date.now()}`,
        plantilla_id: input.plantillaId ?? null,
        factura_id: facturaId,
        parametros_efectivos: input.parametrosEfectivos ?? {
          mapeos: input.mapeos,
          relacionesEstacion: input.relacionesEstacion,
        },
        filas_procesadas: pasadas.length,
        errores: null,
        created_at: new Date().toISOString(),
        nombre_archivo: nombreArchivo,
        user_id: 'mock-user',
      },
    });
  }
}
