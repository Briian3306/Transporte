import { TarifaStatusCatalogo } from '../models/auditoria-tarifas.contracts';
import {
  type TarifaSentido,
  type TarifaStatusPico,
  type TarifarioEditorCell,
  type TarifarioEditorDrafts,
  type TarifarioEditorRow,
  type TarifarioIdentidadExistente,
  type TarifarioImporteCambio,
} from '../models/tarifario.contracts';

export const MISSING_IMPORTE_LABEL = '—';

export const TARIFARIO_STATUS_CATALOG: TarifaStatusCatalogo[] = [
  {
    peaje_id: '*',
    codigo: 'NO_PICO',
    etiqueta: 'No pico',
    color: '#10b981',
    tipo_meta: 'NO_PICO',
    orden: 1,
  },
  {
    peaje_id: '*',
    codigo: 'PICO',
    etiqueta: 'Pico',
    color: '#f59e0b',
    tipo_meta: 'PICO',
    orden: 2,
  },
];

export function formatFechaActualizacion(iso: string | null | undefined): string {
  if (!iso) return MISSING_IMPORTE_LABEL;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return MISSING_IMPORTE_LABEL;
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(d);
}

const SENTIDOS: readonly TarifaSentido[] = ['IDA', 'VUELTA', 'AMBAS'];

export function isTarifaSentido(value: string | null | undefined): value is TarifaSentido {
  return SENTIDOS.includes(value as TarifaSentido);
}

export function isBlankTarifaImporteInput(text: string | null | undefined): boolean {
  if (text == null) return true;
  const s = String(text).trim();
  return s === '' || s === '-';
}

export function parseTarifaImporte(text: string | null | undefined): number | null {
  if (isBlankTarifaImporteInput(text)) return null;
  let s = String(text).trim();
  s = s.replace(/\$/g, '').replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function formatTarifaImporte(n: number): string {
  const [intPart, decPart] = n.toFixed(2).split('.');
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$${withDots},${decPart}`;
}

export function formatTarifaImporteDisplay(n: number | null | undefined): string {
  if (n == null) return MISSING_IMPORTE_LABEL;
  return formatTarifaImporte(n);
}

function emptyCell(): TarifarioEditorCell {
  return {
    tarifa_id: null,
    current_tarifa_importe_id: null,
    importe: null,
    fecha_actualizacion: null,
  };
}

export const TARIFARIO_CATEGORIAS_MIN = 0;
export const TARIFARIO_CATEGORIAS_RECOMENDADAS = 7;
export const TARIFARIO_CATEGORIAS_MAX = 10;
export const TARIFARIO_CATEGORIA_INICIO = 1;

export function clampCategoriasEditor(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(TARIFARIO_CATEGORIAS_MAX, Math.floor(count));
}

export function categoriasEditor(count: number): number[] {
  const n = clampCategoriasEditor(count);
  return Array.from({ length: n }, (_, i) => TARIFARIO_CATEGORIA_INICIO + i);
}

export function countCategoriasEditor(
  existentes: readonly { categoria: number }[],
): number {
  const maxCat = existentes.reduce((max, item) => {
    if (
      item.categoria < TARIFARIO_CATEGORIA_INICIO ||
      item.categoria > TARIFARIO_CATEGORIAS_MAX
    ) {
      return max;
    }
    return Math.max(max, item.categoria);
  }, 0);
  return clampCategoriasEditor(maxCat);
}

export function buildEditorRows(
  existentes: TarifarioIdentidadExistente[],
  categorias: readonly number[] = categoriasEditor(countCategoriasEditor(existentes)),
): TarifarioEditorRow[] {
  return categorias.map((categoria) => {
    const noPico = existentes.find(
      (item) => item.categoria === categoria && item.status === 'NO_PICO',
    );
    const pico = existentes.find(
      (item) => item.categoria === categoria && item.status === 'PICO',
    );
    return {
      categoria,
      no_pico: noPico
        ? {
            tarifa_id: noPico.tarifa_id,
            current_tarifa_importe_id: noPico.current_tarifa_importe_id,
            importe: noPico.importe,
            fecha_actualizacion: noPico.fecha_actualizacion,
          }
        : emptyCell(),
      pico: pico
        ? {
            tarifa_id: pico.tarifa_id,
            current_tarifa_importe_id: pico.current_tarifa_importe_id,
            importe: pico.importe,
            fecha_actualizacion: pico.fecha_actualizacion,
          }
        : emptyCell(),
    };
  });
}

export interface TarifarioDraftError {
  categoria: number;
  status: TarifaStatusPico;
}

export function collectDraftErrores(
  rows: TarifarioEditorRow[],
  drafts: TarifarioEditorDrafts,
): TarifarioDraftError[] {
  const errores: TarifarioDraftError[] = [];
  for (const row of rows) {
    const draft = drafts[row.categoria];
    if (!draft) continue;
    if (!isBlankTarifaImporteInput(draft.no_pico) && parseTarifaImporte(draft.no_pico) == null) {
      errores.push({ categoria: row.categoria, status: 'NO_PICO' });
    }
    if (!isBlankTarifaImporteInput(draft.pico) && parseTarifaImporte(draft.pico) == null) {
      errores.push({ categoria: row.categoria, status: 'PICO' });
    }
  }
  return errores;
}

export function collectCambios(
  rows: TarifarioEditorRow[],
  drafts: TarifarioEditorDrafts,
): TarifarioImporteCambio[] {
  const cambios: TarifarioImporteCambio[] = [];
  for (const row of rows) {
    const draft = drafts[row.categoria];
    if (!draft) continue;
    const noPico = parseTarifaImporte(draft.no_pico);
    if (noPico != null) {
      cambios.push({ categoria: row.categoria, status: 'NO_PICO', importe: noPico });
    }
    const pico = parseTarifaImporte(draft.pico);
    if (pico != null) {
      cambios.push({ categoria: row.categoria, status: 'PICO', importe: pico });
    }
  }
  return cambios;
}
