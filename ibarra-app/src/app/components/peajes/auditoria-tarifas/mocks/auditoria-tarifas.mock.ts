import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import {
  PeajesAuditoriaTarifasService,
  TarifaAsignacion,
  TarifaDiagnostico,
  TarifaGrupoSimilar,
  TarifaNormalizadaRow,
  TarifaStatusCatalogo,
  TarifasNormalizadasFilters,
  TarifasNormalizadasListParams,
  TarifasNormalizadasListResult,
} from '../contracts.local';
import { compareRows, parseSort, patronFromRow } from '../auditoria-tarifas.helpers';

const PEAJE_CV = 'peaje-corredores-viales';
const PEAJE_RSA = 'peaje-rutas-sur';
const PEAJE_CV5 = 'peaje-corredor-vial-5';
const PEAJE_CAD = 'peaje-conexion-alto-delta';

const EST_ZARATE = 'est-zarate-ruta9';
const EST_AGUERO = 'est-aguero-ricchieri';
const EST_LAGOS = 'est-lagos-ruta9';
const EST_LARENA = 'est-larena-ruta8';
const EST_LAGOS_SINGLE = 'est-isla-deseadad';

export const MOCK_STATUS_CATALOG: TarifaStatusCatalogo[] = [
  {
    peaje_id: PEAJE_CV,
    codigo: 'NO_PICO',
    etiqueta: 'No pico',
    color: '#10b981',
    tipo_meta: 'NO_PICO',
    orden: 1,
  },
  {
    peaje_id: PEAJE_CV,
    codigo: 'PICO',
    etiqueta: 'Pico',
    color: '#f59e0b',
    tipo_meta: 'PICO',
    orden: 2,
  },
  {
    peaje_id: PEAJE_RSA,
    codigo: 'NO_PICO',
    etiqueta: 'No pico',
    color: '#10b981',
    tipo_meta: 'NO_PICO',
    orden: 1,
  },
  {
    peaje_id: PEAJE_RSA,
    codigo: 'PICO',
    etiqueta: 'Pico',
    color: '#f59e0b',
    tipo_meta: 'PICO',
    orden: 2,
  },
];

function row(
  partial: Omit<TarifaNormalizadaRow, 'confirmado_manual' | 'categoria'> & {
    categoria?: string | null;
    confirmado_manual?: boolean;
  }
): TarifaNormalizadaRow {
  return {
    categoria: null,
    confirmado_manual: false,
    ...partial,
  };
}

function buildZarate(): TarifaNormalizadaRow[] {
  const base = {
    peaje_id: PEAJE_CV,
    peaje_nombre: 'CORREDORES VIALES SA',
    estacion_id: EST_ZARATE,
    estacion_nombre: 'ZARATE - RUTA 9 KM. 95',
    categoria: null,
    importe_base: 1500,
    muestra_confiable: true,
    diagnostico: 'CATEGORIA' as TarifaDiagnostico,
  };
  return [
    row({
      ...base,
      id: 'zarate-1500',
      importe: 1500,
      cases: 114,
      multiplicador: 1,
      hora_min: 0,
      hora_max: 23,
      hora_media: 13.5,
      desvio: 7.49,
      status: 'NO_PICO',
    }),
    row({
      ...base,
      id: 'zarate-3000',
      importe: 3000,
      cases: 20,
      multiplicador: 2,
      hora_min: 3,
      hora_max: 21,
      hora_media: 14.6,
      desvio: 4.73,
      status: 'PENDIENTE',
    }),
    row({
      ...base,
      id: 'zarate-4500',
      importe: 4500,
      cases: 35,
      multiplicador: 3,
      hora_min: 0,
      hora_max: 23,
      hora_media: 13.7,
      desvio: 6.4,
      status: 'PICO',
    }),
    row({
      ...base,
      id: 'zarate-6000',
      importe: 6000,
      cases: 355,
      multiplicador: 4,
      hora_min: 0,
      hora_max: 23,
      hora_media: 13.1,
      desvio: 5.98,
      status: 'PICO',
    }),
    row({
      ...base,
      id: 'zarate-7500',
      importe: 7500,
      cases: 189,
      multiplicador: 5,
      hora_min: 0,
      hora_max: 23,
      hora_media: 11.8,
      desvio: 7.24,
      status: 'PICO',
    }),
  ];
}

/** AGÜERO expected status codes from CSV (interleaved — tests suggestion mismatch). */
const AGUERO_STATUS_CODES = [
  'PICO',
  'NO_PICO',
  'PICO',
  'NO_PICO',
  'PICO',
  'NO_PICO',
  'PICO',
  'NO_PICO',
  'PICO',
  'NO_PICO',
  'PICO',
  'NO_PICO',
  'PICO',
  'NO_PICO',
  'PICO',
  'NO_PICO',
  'PICO',
];

function buildAguero(): TarifaNormalizadaRow[] {
  const importes = [
    774.41, 900, 1050, 1200, 1400, 1600, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000,
    8000, 8935.49,
  ];
  const base = {
    peaje_id: PEAJE_RSA,
    peaje_nombre: 'RUTAS SUR ATLANTICO S.A.',
    estacion_id: EST_AGUERO,
    estacion_nombre: 'AGÜERO - AU.RICCHIERI KM 15,80',
    categoria: null,
    importe_base: 774.41,
    muestra_confiable: true,
    diagnostico: 'CATEGORIA' as TarifaDiagnostico,
  };
  const totalCases = 102;
  const perLevel = Math.floor(totalCases / importes.length);
  let remainder = totalCases - perLevel * importes.length;

  return importes.map((importe, i) => {
    const cases = perLevel + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return row({
      ...base,
      id: `aguero-${i}`,
      importe,
      cases: Math.max(cases, 1),
      multiplicador: importe / base.importe_base,
      hora_min: i % 3 === 0 ? 8 : 0,
      hora_max: i % 3 === 0 ? 11 : 23,
      hora_media: 12 + (i % 5),
      desvio: i % 2 === 0 ? 2.5 : 6.2,
      status: AGUERO_STATUS_CODES[i] ?? 'PENDIENTE',
    });
  });
}

function buildLagos(): TarifaNormalizadaRow[] {
  const base = {
    peaje_id: PEAJE_CV,
    peaje_nombre: 'CORREDORES VIALES SA',
    estacion_id: EST_LAGOS,
    estacion_nombre: 'LAGOS - RUTA 9 KM. 272',
    categoria: null,
    importe_base: 1500,
    muestra_confiable: true,
    diagnostico: 'CATEGORIA' as TarifaDiagnostico,
  };
  return [1500, 3000, 4500, 6000, 7500].map((importe, i) =>
    row({
      ...base,
      id: `lagos-${importe}`,
      importe,
      cases: [40, 30, 35, 50, 23][i],
      multiplicador: importe / 1500,
      hora_min: 0,
      hora_max: 23,
      hora_media: 13,
      desvio: 7,
      status: 'PENDIENTE',
    })
  );
}

function buildLarena(): TarifaNormalizadaRow[] {
  const base = {
    peaje_id: PEAJE_CV,
    peaje_nombre: 'CORREDORES VIALES SA',
    estacion_id: EST_LARENA,
    estacion_nombre: 'LARENA - RUTA 8 KM 65',
    categoria: null,
    importe_base: 1500,
    diagnostico: 'POSIBLE_HORARIO' as TarifaDiagnostico,
    muestra_confiable: true,
  };
  return [1500, 3000, 4500, 7500].map((importe, i) =>
    row({
      ...base,
      id: `larena-${importe}`,
      importe,
      cases: [30, 25, 28, 23][i],
      multiplicador: importe / 1500,
      hora_min: 7,
      hora_max: 10,
      hora_media: 8.5,
      desvio: 1.2,
      status: 'PENDIENTE',
    })
  );
}

function buildSingleLevel(): TarifaNormalizadaRow[] {
  return [
    row({
      id: 'isla-5219',
      peaje_id: PEAJE_CAD,
      peaje_nombre: 'CONEXION ALTO DELTA S.A.',
      estacion_id: EST_LAGOS_SINGLE,
      estacion_nombre: 'ISLA LA DESEADA - RUTA 174 KM 5,2',
      importe: 5219.58,
      cases: 2,
      importe_base: 5219.58,
      multiplicador: 1,
      hora_min: 10,
      hora_max: 14,
      hora_media: 12,
      desvio: 1.5,
      muestra_confiable: false,
      diagnostico: 'MUESTRA_INSUFICIENTE',
      status: 'PENDIENTE',
    }),
  ];
}

function buildExtraRows(): TarifaNormalizadaRow[] {
  const extras: TarifaNormalizadaRow[] = [];
  for (let i = 0; i < 30; i++) {
    extras.push(
      row({
        id: `extra-${i}`,
        peaje_id: PEAJE_CV5,
        peaje_nombre: 'CORREDOR VIAL 5 S.A.U.',
        estacion_id: `est-extra-${i}`,
        estacion_nombre: `ESTACIÓN EXTRA ${i + 1}`,
        importe: 6000 + i * 100,
        cases: 15 - (i % 10),
        importe_base: 6000,
        multiplicador: 1 + i * 0.1,
        hora_min: 0,
        hora_max: 23,
        hora_media: 14,
        desvio: 5 + (i % 3),
        muestra_confiable: i % 4 !== 0,
        diagnostico: i % 5 === 0 ? 'POSIBLE_HORARIO' : 'CATEGORIA',
        status: i % 7 === 0 ? 'PICO' : 'PENDIENTE',
      })
    );
  }
  return extras;
}

function seedRows(): TarifaNormalizadaRow[] {
  return [
    ...buildZarate(),
    ...buildAguero(),
    ...buildLagos(),
    ...buildLarena(),
    ...buildSingleLevel(),
    ...buildExtraRows(),
  ];
}

function applyFilters(rows: TarifaNormalizadaRow[], filters: TarifasNormalizadasFilters): TarifaNormalizadaRow[] {
  let result = [...rows];

  if (filters.peaje_ids?.length) {
    result = result.filter((r) => filters.peaje_ids!.includes(r.peaje_id));
  }
  if (filters.estacion_ids?.length) {
    result = result.filter((r) => filters.estacion_ids!.includes(r.estacion_id));
  }
  if (filters.categorias?.length) {
    result = result.filter((r) => r.categoria != null && filters.categorias!.includes(r.categoria));
  }
  if (filters.diagnosticos?.length) {
    result = result.filter((r) => filters.diagnosticos!.includes(r.diagnostico));
  }
  if (filters.status?.length) {
    result = result.filter((r) => filters.status!.includes(r.status));
  }
  if (filters.patron) {
    result = result.filter((r) => patronFromRow(r) === filters.patron);
  }
  if (filters.solo_muestra_confiable) {
    result = result.filter((r) => r.muestra_confiable);
  }
  if (filters.q_estacion?.trim()) {
    const q = filters.q_estacion.trim().toLowerCase();
    result = result.filter((r) => r.estacion_nombre.toLowerCase().includes(q));
  }

  return result;
}

@Injectable()
export class AuditoriaTarifasMockService implements PeajesAuditoriaTarifasService {
  private rows: TarifaNormalizadaRow[] = seedRows();
  private readonly failConfirm = false;

  listar(params: TarifasNormalizadasListParams = {}): Observable<TarifasNormalizadasListResult> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const filters = params.filters ?? {};
    const { key, direction } = parseSort(params.sort);

    let filtered = applyFilters(this.rows, filters);
    filtered.sort((a, b) => compareRows(a, b, key, direction));

    const start = (page - 1) * pageSize;
    const slice = filtered.slice(start, start + pageSize);

    return of({
      rows: slice,
      total: filtered.length,
      page,
      pageSize,
    }).pipe(delay(50));
  }

  listarStatusCatalogo(peajeId: string): Observable<TarifaStatusCatalogo[]> {
    const catalog = MOCK_STATUS_CATALOG.filter((c) => c.peaje_id === peajeId);
    return of(catalog.length ? catalog : MOCK_STATUS_CATALOG.filter((c) => c.peaje_id === PEAJE_CV));
  }

  listarCategorias(peajeIds?: string[]): Observable<string[]> {
    let rows = this.rows;
    if (peajeIds?.length) {
      rows = rows.filter((r) => peajeIds.includes(r.peaje_id));
    }
    const cats = [...new Set(rows.map((r) => r.categoria).filter((c): c is string => c != null))];
    return of(cats.sort());
  }

  confirmarStatus(asignaciones: TarifaAsignacion[]): Observable<{ actualizadas: number }> {
    if (this.failConfirm) {
      return throwError(() => new Error('Mock confirm failure'));
    }
    asignaciones.forEach(({ tarifa_normalizada_id, status_codigo }) => {
      const row = this.rows.find((r) => r.id === tarifa_normalizada_id);
      if (row) {
        row.status = status_codigo;
        row.confirmado_manual = true;
        if (row.diagnostico !== 'REVISAR' && row.diagnostico !== 'CATEGORIA') {
          row.diagnostico = 'CONFIRMADO';
        }
      }
    });
    return of({ actualizadas: asignaciones.length }).pipe(delay(80));
  }

  marcarDiagnostico(
    tarifaNormalizadaId: string,
    diagnostico: TarifaDiagnostico
  ): Observable<TarifaNormalizadaRow> {
    const row = this.rows.find((r) => r.id === tarifaNormalizadaId);
    if (!row) {
      return throwError(() => new Error('Not found'));
    }
    row.diagnostico = diagnostico;
    return of({ ...row }).pipe(delay(50));
  }

  gruposSimilares(tarifaNormalizadaId: string, _tolerancia: number): Observable<TarifaGrupoSimilar[]> {
    const source = this.rows.find((r) => r.id === tarifaNormalizadaId);
    if (!source) {
      return of([]);
    }
    const sourceFamily = this.rows.filter((r) => r.estacion_id === source.estacion_id);
    const sourceMin = Math.min(...sourceFamily.map((r) => r.importe));
    const sourceMax = Math.max(...sourceFamily.map((r) => r.importe));
    const sourceRatio = sourceMax / sourceMin;
    const sourceLevels = sourceFamily.length;

    const stationIds = new Set(
      this.rows.filter((r) => r.peaje_id === source.peaje_id).map((r) => r.estacion_id)
    );

    const groups: TarifaGrupoSimilar[] = [];
    stationIds.forEach((estacionId) => {
      if (estacionId === source.estacion_id) return;
      const family = this.rows.filter((r) => r.estacion_id === estacionId);
      if (!family.length) return;
      const min = Math.min(...family.map((r) => r.importe));
      const max = Math.max(...family.map((r) => r.importe));
      const ratio = max / min;
      if (Math.abs(ratio - sourceRatio) > 0.05) return;

      groups.push({
        estacion_id: estacionId,
        estacion_nombre: family[0].estacion_nombre,
        categoria: family[0].categoria,
        niveles: family.length,
        cases: family.reduce((s, r) => s + r.cases, 0),
        importe_min: min,
        importe_max: max,
        ratio,
        pendientes: family.filter((r) => r.status === 'PENDIENTE').length,
        tarifa_ids: [...family].sort((a, b) => a.importe - b.importe).map((r) => r.id),
      });
    });

    return of(groups).pipe(delay(60));
  }

  recalcular(peajeId: string): Observable<{ familias: number }> {
    const count = new Set(
      this.rows.filter((r) => r.peaje_id === peajeId).map((r) => r.estacion_id)
    ).size;
    return of({ familias: count }).pipe(delay(200));
  }
}

export { PEAJE_CV, PEAJE_RSA, EST_ZARATE, EST_AGUERO, buildZarate, buildAguero };
