import { DateRangeValue, endOfDay, startOfDay } from '../date-range-picker/date-range.types';
import { SearchMultiSelectOption } from '../search-multi-select/search-multi-select.types';
import {
  DataTableColumn,
  DataTableColumnFilterValue,
  DataTableFilterState,
} from './data-table.types';

function cellText(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v == null) return '';
  return String(v);
}

function matchesText(haystack: string, needle: string): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}

function matchesDateRange(raw: unknown, range: DateRangeValue): boolean {
  if (!range.from && !range.to) return true;
  if (raw == null || raw === '') return false;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(d.getTime())) return false;
  const t = d.getTime();
  if (range.from && t < startOfDay(range.from).getTime()) return false;
  if (range.to && t > endOfDay(range.to).getTime()) return false;
  return true;
}

function matchesColumnValue(
  row: Record<string, unknown>,
  key: string,
  value: DataTableColumnFilterValue,
  type: string
): boolean {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) {
    return true;
  }
  const cell = cellText(row, key);
  switch (type) {
    case 'text':
      return matchesText(cell, String(value));
    case 'search-select':
    case 'multiselect': {
      const ids = value as string[];
      // Match against cell text or exact id-like value
      return ids.some((id) => cell === id || cell.toLowerCase() === id.toLowerCase());
    }
    case 'date-range':
      return matchesDateRange(row[key], value as DateRangeValue);
    default:
      return true;
  }
}

/**
 * Apply global + column filters to a full row set (client-side).
 * `globalKeys` limits which columns the global search inspects.
 */
export function applyDataTableFilters(
  rows: readonly Record<string, unknown>[],
  columns: readonly DataTableColumn[],
  filters: DataTableFilterState,
  globalKeys: readonly string[]
): Record<string, unknown>[] {
  const colMeta = new Map(columns.map((c) => [c.key, c]));
  const globalQ = filters.global.trim().toLowerCase();

  return rows.filter((row) => {
    if (globalQ) {
      const keys =
        globalKeys.length > 0
          ? globalKeys
          : columns.filter((c) => c.searchable !== false && (!c.filter || c.filter.type === 'text')).map((c) => c.key);
      const hit = keys.some((k) => cellText(row, k).toLowerCase().includes(globalQ));
      if (!hit) return false;
    }

    for (const [key, value] of Object.entries(filters.columns)) {
      const col = colMeta.get(key);
      const type = col?.filter?.type ?? 'text';
      if (!matchesColumnValue(row, key, value, type)) {
        return false;
      }
    }
    return true;
  });
}

/** Distinct string options from rows for a column key. */
export function deriveFilterOptions(
  rows: readonly Record<string, unknown>[],
  key: string
): SearchMultiSelectOption[] {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const label = cellText(row, key).trim();
    if (!label) continue;
    if (!seen.has(label)) {
      seen.set(label, label);
    }
  }
  return [...seen.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}
