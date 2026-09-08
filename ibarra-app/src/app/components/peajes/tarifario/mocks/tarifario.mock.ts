import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  PeajesTarifarioService,
  TarifaSentido,
  TarifaStatusPico,
  TarifarioCurrentRow,
  TarifarioEditorPayload,
  TarifarioFilters,
  TarifarioHistorialItem,
  TarifarioIdentidadExistente,
  TarifarioImporteCambio,
  TarifarioListParams,
  TarifarioListResult,
} from '../../models/tarifario.contracts';

export const PEAJE_AUBASA = 'peaje-aubasa';
export const ESTACION_HUDSON = 'estacion-hudson';
export const ESTACION_BERNAL = 'estacion-bernal';
export const ESTACION_INCOMPLETA = 'estacion-incompleta';
export const ESTACION_VACIA = 'estacion-vacia';
export const TI_099 = 'TI-099';
export const TI_100 = 'TI-100';

interface CatalogEstacion {
  id: string;
  nombre: string;
  peaje_id: string;
}

interface TarifaIdentidad {
  id: string;
  peaje_id: string;
  estacion_id: string;
  status: TarifaStatusPico;
  categoria: number;
  sentido: TarifaSentido;
  current_tarifa_id: string | null;
  fecha_actualizacion: string | null;
}

interface TarifaImporteRow {
  id: string;
  tarifa_id: string;
  importe: number;
  fecha_aparicion: string;
}

const PEAJES: { id: string; nombre: string }[] = [{ id: PEAJE_AUBASA, nombre: 'AUBASA' }];

const ESTACIONES: CatalogEstacion[] = [
  { id: ESTACION_HUDSON, nombre: 'HUDSON', peaje_id: PEAJE_AUBASA },
  { id: ESTACION_BERNAL, nombre: 'BERNAL', peaje_id: PEAJE_AUBASA },
  { id: ESTACION_INCOMPLETA, nombre: 'INCOMPLETA', peaje_id: PEAJE_AUBASA },
  { id: ESTACION_VACIA, nombre: 'VACIA', peaje_id: PEAJE_AUBASA },
];

let seq = 1;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

function identityKey(
  peajeId: string,
  estacionId: string,
  status: TarifaStatusPico,
  categoria: number,
  sentido: TarifaSentido,
): string {
  return `${peajeId}|${estacionId}|${status}|${categoria}|${sentido}`;
}

function seedState(): { tarifas: TarifaIdentidad[]; importes: TarifaImporteRow[] } {
  seq = 200;
  const tarifas: TarifaIdentidad[] = [];
  const importes: TarifaImporteRow[] = [];
  const now = '2026-03-10T00:00:00.000Z';
  const older = '2025-08-21T00:00:00.000Z';

  const add = (
    id: string,
    estacionId: string,
    status: TarifaStatusPico,
    categoria: number,
    sentido: TarifaSentido,
    currentId: string,
    importe: number,
    extras: TarifaImporteRow[] = [],
  ) => {
    tarifas.push({
      id,
      peaje_id: PEAJE_AUBASA,
      estacion_id: estacionId,
      status,
      categoria,
      sentido,
      current_tarifa_id: currentId,
      fecha_actualizacion: now,
    });
    importes.push(...extras, {
      id: currentId,
      tarifa_id: id,
      importe,
      fecha_aparicion: now,
    });
  };

  add('tarifa-hudson-ida-1-np', ESTACION_HUDSON, 'NO_PICO', 1, 'IDA', TI_100, 5500, [
    { id: TI_099, tarifa_id: 'tarifa-hudson-ida-1-np', importe: 5000, fecha_aparicion: older },
  ]);
  add('tarifa-hudson-ida-1-p', ESTACION_HUDSON, 'PICO', 1, 'IDA', 'ti-h-ida-1-p', 6000);
  add('tarifa-hudson-ida-2-np', ESTACION_HUDSON, 'NO_PICO', 2, 'IDA', 'ti-h-ida-2-np', 7000);
  add('tarifa-hudson-ida-2-p', ESTACION_HUDSON, 'PICO', 2, 'IDA', 'ti-h-ida-2-p', 7500);

  add('tarifa-hudson-vue-1-np', ESTACION_HUDSON, 'NO_PICO', 1, 'VUELTA', 'ti-h-vue-1-np', 5700);
  add('tarifa-hudson-vue-1-p', ESTACION_HUDSON, 'PICO', 1, 'VUELTA', 'ti-h-vue-1-p', 6200);
  add('tarifa-hudson-vue-2-np', ESTACION_HUDSON, 'NO_PICO', 2, 'VUELTA', 'ti-h-vue-2-np', 7200);
  add('tarifa-hudson-vue-2-p', ESTACION_HUDSON, 'PICO', 2, 'VUELTA', 'ti-h-vue-2-p', 7700);

  add('tarifa-bernal-ambas-1-np', ESTACION_BERNAL, 'NO_PICO', 1, 'AMBAS', 'ti-b-1-np', 5000);
  add('tarifa-bernal-ambas-1-p', ESTACION_BERNAL, 'PICO', 1, 'AMBAS', 'ti-b-1-p', 5500);
  add('tarifa-bernal-ambas-2-np', ESTACION_BERNAL, 'NO_PICO', 2, 'AMBAS', 'ti-b-2-np', 6500);
  add('tarifa-bernal-ambas-2-p', ESTACION_BERNAL, 'PICO', 2, 'AMBAS', 'ti-b-2-p', 7000);

  add('tarifa-inc-1-np', ESTACION_INCOMPLETA, 'NO_PICO', 1, 'IDA', 'ti-i-1-np', 5500);
  add('tarifa-inc-1-p', ESTACION_INCOMPLETA, 'PICO', 1, 'IDA', 'ti-i-1-p', 6000);
  add('tarifa-inc-2-np', ESTACION_INCOMPLETA, 'NO_PICO', 2, 'IDA', 'ti-i-2-np', 7000);
  add('tarifa-inc-3-p', ESTACION_INCOMPLETA, 'PICO', 3, 'IDA', 'ti-i-3-p', 9500);

  return { tarifas, importes };
}

@Injectable()
export class TarifarioMockService implements PeajesTarifarioService {
  private tarifas: TarifaIdentidad[] = [];
  private importes: TarifaImporteRow[] = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    const seeded = seedState();
    this.tarifas = seeded.tarifas;
    this.importes = seeded.importes;
  }

  listar(params: TarifarioListParams = {}): Observable<TarifarioListResult> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const filtered = this.currentRows().filter((row) => matchesFilters(row, params.filters));
    const sorted = sortRows(filtered, params.sort ?? 'estacion_nombre:asc');
    const start = (page - 1) * pageSize;
    return of({
      rows: sorted.slice(start, start + pageSize),
      total: sorted.length,
      page,
      pageSize,
    });
  }

  obtenerEditor(
    peajeId: string,
    estacionId: string,
    sentido: TarifaSentido,
  ): Observable<TarifarioEditorPayload> {
    const peaje = PEAJES.find((p) => p.id === peajeId);
    const estacion = ESTACIONES.find((e) => e.id === estacionId);
    const existentes: TarifarioIdentidadExistente[] = this.tarifas
      .filter(
        (t) => t.peaje_id === peajeId && t.estacion_id === estacionId && t.sentido === sentido,
      )
      .map((t) => this.toExistente(t));
    return of({
      context: {
        peaje_id: peajeId,
        peaje_nombre: peaje?.nombre ?? peajeId,
        estacion_id: estacionId,
        estacion_nombre: estacion?.nombre ?? estacionId,
        sentido,
      },
      existentes,
    });
  }

  guardar(
    peajeId: string,
    estacionId: string,
    sentido: TarifaSentido,
    cambios: TarifarioImporteCambio[],
  ): Observable<{ actualizadas: number }> {
    const stamp = new Date().toISOString();
    for (const cambio of cambios) {
      const key = identityKey(peajeId, estacionId, cambio.status, cambio.categoria, sentido);
      let tarifa = this.tarifas.find(
        (t) => identityKey(t.peaje_id, t.estacion_id, t.status, t.categoria, t.sentido) === key,
      );
      if (!tarifa) {
        tarifa = {
          id: nextId('tarifa'),
          peaje_id: peajeId,
          estacion_id: estacionId,
          status: cambio.status,
          categoria: cambio.categoria,
          sentido,
          current_tarifa_id: null,
          fecha_actualizacion: null,
        };
        this.tarifas.push(tarifa);
      }
      const importeId = nextId('TI');
      this.importes.push({
        id: importeId,
        tarifa_id: tarifa.id,
        importe: cambio.importe,
        fecha_aparicion: stamp,
      });
      tarifa.current_tarifa_id = importeId;
      tarifa.fecha_actualizacion = stamp;
    }
    return of({ actualizadas: cambios.length });
  }

  listarHistorial(tarifaId: string): Observable<TarifarioHistorialItem[]> {
    const tarifa = this.tarifas.find((t) => t.id === tarifaId);
    const rows = this.importes
      .filter((i) => i.tarifa_id === tarifaId)
      .sort((a, b) => (a.fecha_aparicion < b.fecha_aparicion ? 1 : a.fecha_aparicion > b.fecha_aparicion ? -1 : 0))
      .map((i) => ({
        id: i.id,
        importe: i.importe,
        fecha_aparicion: i.fecha_aparicion,
        es_actual: tarifa?.current_tarifa_id === i.id,
      }));
    return of(rows);
  }

  private toExistente(t: TarifaIdentidad): TarifarioIdentidadExistente {
    const current = this.importes.find((i) => i.id === t.current_tarifa_id);
    return {
      tarifa_id: t.id,
      categoria: t.categoria,
      status: t.status,
      current_tarifa_importe_id: t.current_tarifa_id,
      importe: current?.importe ?? null,
      fecha_actualizacion: t.fecha_actualizacion,
    };
  }

  private currentRows(): TarifarioCurrentRow[] {
    return this.tarifas.map((t) => {
      const current = this.importes.find((i) => i.id === t.current_tarifa_id);
      const peaje = PEAJES.find((p) => p.id === t.peaje_id);
      const estacion = ESTACIONES.find((e) => e.id === t.estacion_id);
      return {
        tarifa_id: t.id,
        peaje_id: t.peaje_id,
        peaje_nombre: peaje?.nombre ?? null,
        estacion_id: t.estacion_id,
        estacion_nombre: estacion?.nombre ?? t.estacion_id,
        categoria: t.categoria,
        status: t.status,
        sentido: t.sentido,
        importe: current?.importe ?? null,
        fecha_actualizacion: t.fecha_actualizacion,
        current_tarifa_importe_id: t.current_tarifa_id,
      };
    });
  }
}

export const MOCK_TARIFARIO_PEAJES = PEAJES;
export const MOCK_TARIFARIO_ESTACIONES = ESTACIONES;

function matchesFilters(row: TarifarioCurrentRow, filters?: TarifarioFilters): boolean {
  if (!filters) return true;
  if (filters.peaje_ids?.length && !filters.peaje_ids.includes(row.peaje_id)) return false;
  if (filters.estacion_ids?.length && !filters.estacion_ids.includes(row.estacion_id)) return false;
  if (filters.categorias?.length && !filters.categorias.includes(row.categoria)) return false;
  if (filters.status?.length && !filters.status.includes(row.status)) return false;
  if (filters.sentidos?.length && !filters.sentidos.includes(row.sentido)) return false;
  if (filters.q_estacion) {
    const q = filters.q_estacion.trim().toLowerCase();
    if (q && !row.estacion_nombre.toLowerCase().includes(q)) return false;
  }
  return true;
}

function sortRows(rows: TarifarioCurrentRow[], sort: string): TarifarioCurrentRow[] {
  const [keyRaw, dirRaw] = sort.split(':');
  const key = (keyRaw || 'estacion_nombre') as keyof TarifarioCurrentRow;
  const dir = dirRaw === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}
