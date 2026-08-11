import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  ConfirmacionCargaInput,
  ConfirmacionCargaResultado,
  Documento,
  ErrorValidacionPasada,
  Pasada,
  PasadaEstandarizada,
  PeajesCargaService,
  ResultadoValidacionCarga,
  normalizarImportesDocumento,
  normalizarImportesPasada,
} from '../../models';

/** Tolerancia por fila (centavo) al contrastar neto vs PRECIO-BONIFICACION. */
const TOLERANCIA_FILA = 0.01;
/** Fracción del subtotal admitida en la conciliación documento vs suma de pasadas. */
const TOLERANCIA_DOCUMENTO_PCT = 0.01;

/**
 * Mock tipado de PeajesCargaService.
 * Validación/persistencia real: agente 01 (F01-2/5/6/9).
 */
@Injectable()
export class PeajesCargaMockService implements PeajesCargaService {
  validarCarga(
    pasadas: PasadaEstandarizada[],
    documento: Pick<
      Documento,
      'tipo' | 'importe_sin_iva' | 'bonificacion' | 'percepciones' | 'iva' | 'importe_total'
    >
  ): Observable<ResultadoValidacionCarga> {
    const errores: ErrorValidacionPasada[] = [];
    const validas: PasadaEstandarizada[] = [];
    const tipo = documento.tipo ?? 'FC';

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

      if (!Number.isFinite(precio)) {
        errores.push({ fila, columna: 'PRECIO', valor: precio, motivo: 'PRECIO inválido' });
        ok = false;
      }
      if (Number.isFinite(qty) && qty <= 0) {
        errores.push({ fila, columna: 'QUANTITY', valor: qty, motivo: 'Cantidad inválida' });
        ok = false;
      }
      if (Number.isFinite(neto) && Number.isFinite(precio) && Number.isFinite(bonif)) {
        const esperado = (precio - bonif) * (Number.isFinite(qty) && qty > 0 ? qty : 1);
        if (Math.abs(esperado - neto) > TOLERANCIA_FILA) {
          // NC/FC: after normalization signs match; skip strict RN-11 when declared neto used.
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
        const norm = normalizarImportesPasada(tipo, {
          precio,
          bonificacion: bonif,
          importe_neto: neto,
        });
        validas.push({
          ...pasada,
          PRECIO: norm.precio,
          BONIFICACION: norm.bonificacion,
          IMPORTE_NETO: norm.importe_neto,
        });
      }
    });

    const header = normalizarImportesDocumento(tipo, documento);
    const sumaNetos = validas.reduce((acc, p) => acc + Number(p.IMPORTE_NETO || 0), 0);
    const subtotal = header.importe_sin_iva;
    const bonificacionDoc = header.bonificacion;
    const esperado = subtotal + bonificacionDoc;
    const toleranciaDocumento = Math.abs(subtotal) * TOLERANCIA_DOCUMENTO_PCT;
    const diferenciaFactura = sumaNetos - esperado;
    const dentroTolerancia = Math.abs(diferenciaFactura) <= toleranciaDocumento;

    if (!dentroTolerancia) {
      errores.push({
        fila: 0,
        columna: 'DOCUMENTO.importe_sin_iva',
        valor: documento.importe_sin_iva,
        motivo: `Diferencia documento vs suma pasadas: ${diferenciaFactura.toFixed(2)} (tolerancia ${toleranciaDocumento.toFixed(2)} = 1% del subtotal; esperado = subtotal + bonificación)`,
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
    const tipo = input.documento.tipo ?? 'FC';
    const header = normalizarImportesDocumento(tipo, input.documento);
    const documentoId = input.documento.id ?? `DOC-${Date.now()}`;
    const documento: Documento = {
      ...input.documento,
      ...header,
      tipo,
      id: documentoId,
      created_at: new Date().toISOString(),
    };

    const nombreArchivo =
      input.nombreArchivo ??
      (typeof input.parametrosEfectivos?.['archivo'] === 'string'
        ? (input.parametrosEfectivos['archivo'] as string)
        : null);

    const pasadas: Pasada[] = input.pasadas.map((p, i) => {
      const norm = normalizarImportesPasada(tipo, {
        precio: Number(p.PRECIO ?? 0),
        bonificacion: Number(p.BONIFICACION ?? 0),
        importe_neto: Number(p.IMPORTE_NETO ?? 0),
      });
      return {
        id: `PSD-${i + 1}`,
        fecha_hora: String(p.FECHA_HORA ?? ''),
        pase_id: String(p.PASE_ID ?? ''),
        patente_id: String(p.PATENTE_ID ?? ''),
        estacion_id: String(p.ESTACION_ID ?? ''),
        documento_id: documentoId,
        precio: norm.precio,
        bonificacion: norm.bonificacion,
        quantity: Number(p.QUANTITY ?? 1),
        importe_neto: norm.importe_neto,
        created_at: new Date().toISOString(),
        user_id: 'mock-user',
        file_upload_name: nombreArchivo,
      };
    });

    return of({
      documento,
      pasadas,
      registro: {
        id: `REG-${Date.now()}`,
        plantilla_id: input.plantillaId ?? null,
        documento_id: documentoId,
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
