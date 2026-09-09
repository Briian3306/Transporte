import type { DateRangeValue } from '../date-range-picker/date-range.types';
import type { SearchMultiSelectOption } from '../search-multi-select/search-multi-select.types';

export type DataTableAlign = 'left' | 'center' | 'right';

export type DataTableFilterType = 'text' | 'search-select' | 'multiselect' | 'date-range';

export interface DataTableColumnFilter {
  type: DataTableFilterType;
  /** Placeholder / hint for the control (defaults to column label). */
  placeholder?: string;
  /**
   * Options for search-select / multiselect.
   * When omitted and client filtering is on, distinct values are derived from rows.
   */
  options?: SearchMultiSelectOption[];
}

export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: DataTableAlign;
  /** Hide cell text when a custom template is provided for this key. */
  templateOnly?: boolean;
  /**
   * Reserved for future inline row editing.
   * See docs/06-components/shared/data-table.md (roadmap).
   */
  editable?: boolean;
  /** When set, a column filter control is rendered (if filterableColumnsInputs). */
  filter?: DataTableColumnFilter;
  /**
   * Include this column in the global search.
   * Defaults to true when filter.type === 'text', otherwise false unless listed in searchableInputMain.
   */
  searchable?: boolean;
}

export interface DataTableSort {
  key: string;
  direction: 'asc' | 'desc';
}

export interface DataTablePageChange {
  page: number;
  pageSize: number;
}

/** Per-column filter values keyed by column.key */
export type DataTableColumnFilterValue = string | string[] | DateRangeValue | null;

export interface DataTableFilterState {
  global: string;
  columns: Record<string, DataTableColumnFilterValue>;
}

export function emptyDataTableFilterState(): DataTableFilterState {
  return { global: '', columns: {} };
}
