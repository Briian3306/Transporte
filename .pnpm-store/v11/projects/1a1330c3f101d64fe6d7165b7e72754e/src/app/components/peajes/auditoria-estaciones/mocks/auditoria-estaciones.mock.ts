import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  AuditoriaEstacionRow,
  AuditoriaEstacionesListParams,
  AuditoriaEstacionesListResult,
  CorreccionEstacionInput,
  EstadoCasoAuditoriaEstacion,
  PeajesAuditoriaEstacionesService,
  PreviewCorreccionEstacion,
  fingerprintCasoEstacion,
} from '../../models/auditoria-estaciones.contracts';

export const FIXTURE_SECUENCIA: AuditoriaEstacionRow = {
  empresaId: 'emp-1',
  peajeId: 'peaje-seq',
  estacionId: 'est-5',
  empresaNombre: 'Empresa demo',
  peajeNombre: 'Peaje secuencia',
  estacionNombre: 'Estación 5',
  codigoProveedor: '5',
  codigoNormalizado: '5',
  fuentes: ['catalogo'],
  codigosEstacion: ['1', '2', '3', '5'],
  estacionesMismoCodigo: 1,
  secuenciaEsperada: { minimo: 1, maximo: 5, faltantes: [4] },
  hallazgos: ['SECUENCIA_NUMERICA_CON_SALTO'],
  casoId: null,
  estado: 'PENDIENTE',
  observacion: null,
  movimientosAfectados: 12,
  fingerprint: fingerprintCasoEstacion({
    empresaId: 'emp-1',
    peajeId: 'peaje-seq',
    tipo: 'SECUENCIA_NUMERICA_CON_SALTO',
    codigosNormalizados: ['1', '2', '3', '5'],
  }),
};

export const FIXTURE_AISLADO: AuditoriaEstacionRow = {
  empresaId: 'emp-1',
  peajeId: 'peaje-iso',
  estacionId: 'est-iso',
  empresaNombre: 'Empresa demo',
  peajeNombre: 'Peaje aislado',
  estacionNombre: 'Estación 3 y 5',
  codigoProveedor: '3',
  codigoNormalizado: '3',
  fuentes: ['catalogo'],
  codigosEstacion: ['3', '5'],
  estacionesMismoCodigo: 1,
  secuenciaEsperada: null,
  hallazgos: [],
  casoId: 'caso-ok',
  estado: 'PENDIENTE',
  observacion: null,
  movimientosAfectados: 2,
  fingerprint: 'iso',
};

@Injectable()
export class AuditoriaEstacionesMockService implements PeajesAuditoriaEstacionesService {
  rows: AuditoriaEstacionRow[] = [
    { ...FIXTURE_SECUENCIA },
    { ...FIXTURE_AISLADO },
  ];

  listar(params: AuditoriaEstacionesListParams = {}): Observable<AuditoriaEstacionesListResult> {
    let rows = [...this.rows];
    const estados = params.filters?.estados;
    if (estados?.length) {
      rows = rows.filter((r) => estados.includes(r.estado));
    }
    return of({
      rows,
      total: rows.length,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
    });
  }

  transicionar(
    casoId: string | null,
    fingerprint: string,
    estado: EstadoCasoAuditoriaEstacion,
    observacion: string | null,
    _row?: unknown,
  ): Observable<{ casoId: string; estado: EstadoCasoAuditoriaEstacion }> {
    const row = this.rows.find((r) => r.fingerprint === fingerprint);
    if (!row) return throwError(() => new Error('caso no encontrado'));
    row.estado = estado;
    row.observacion = observacion;
    row.casoId = casoId ?? row.casoId ?? 'caso-1';
    return of({ casoId: row.casoId, estado });
  }

  previsualizar(casoId: string, estacionDestinoId: string): Observable<PreviewCorreccionEstacion> {
    return of({
      casoId,
      previewHash: 'hash-demo',
      estacionOrigenId: 'est-5',
      estacionDestinoId,
      aliasAjustes: [],
      catalogoAjustes: [],
      pasadas: [{ id: 'p1', fechaHora: '2026-08-01T00:00:00Z' }],
    });
  }

  corregir(input: CorreccionEstacionInput): Observable<{ casoId: string; estado: EstadoCasoAuditoriaEstacion }> {
    if (!input.previewHash) {
      return throwError(() => new Error('se requiere previsualización y confirmación'));
    }
    const row = this.rows.find((r) => r.casoId === input.casoId) ?? this.rows[0];
    row.estado = 'CORREGIDO';
    return of({ casoId: row.casoId ?? input.casoId, estado: 'CORREGIDO' });
  }
}
