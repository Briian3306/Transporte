export type DataTableAlign = 'left' | 'center' | 'right';

export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: DataTableAlign;
  /** Hide cell text when a custom template is provided for this key. */
  templateOnly?: boolean;
}

export interface DataTableSort {
  key: string;
  direction: 'asc' | 'desc';
}

export interface DataTablePageChange {
  page: number;
  pageSize: number;
}
