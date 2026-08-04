import {
  Component,
  ContentChildren,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  QueryList,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableColumnDirective } from './data-table-column.directive';
import {
  DataTableColumn,
  DataTableColumnFilterValue,
  DataTableFilterState,
  DataTablePageChange,
  DataTableSort,
  emptyDataTableFilterState,
} from './data-table.types';
import { applyDataTableFilters, deriveFilterOptions } from './data-table-filter.util';
import { DateRangePickerComponent } from '../date-range-picker/date-range-picker.component';
import { DateRangeValue } from '../date-range-picker/date-range.types';
import { SearchMultiSelectComponent } from '../search-multi-select/search-multi-select.component';
import { SearchMultiSelectOption } from '../search-multi-select/search-multi-select.types';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DateRangePickerComponent,
    SearchMultiSelectComponent,
  ],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css',
})
export class DataTableComponent implements OnChanges {
  @Input({ required: true }) columns: DataTableColumn[] = [];
  /** Current page rows (server mode) or full dataset (when clientFilter). */
  @Input() rows: readonly Record<string, unknown>[] = [];
  @Input() loading = false;
  @Input() emptyMessage = 'No hay registros para mostrar.';
  @Input() selectable = false;
  @Input() selectedIds: readonly string[] = [];
  @Input() rowIdKey = 'id';
  @Input() sort: DataTableSort | null = null;
  @Input() page = 1;
  @Input() pageSize = 50;
  @Input() total = 0;
  @Input() pageSizeOptions: number[] = [25, 50, 100];
  @Input() exportEnabled = false;
  @Input() exportLabel = 'Exportar';

  /**
   * When true, render filter controls for every column that declares `filter`.
   */
  @Input() filterableColumnsInputs = false;
  /**
   * Column keys included in the global search box.
   * Empty + filterableColumnsInputs → searchable text columns (or keys with searchable: true).
   */
  @Input() searchableInputMain: string[] = [];
  /**
   * When true, `rows` is treated as the full dataset; filters + pagination run inside the table.
   */
  @Input() clientFilter = false;
  /** Extra/static options keyed by column key (overrides derived options). */
  @Input() filterOptions: Record<string, SearchMultiSelectOption[]> = {};
  /** Controlled filter state (optional). */
  @Input() filters: DataTableFilterState | null = null;

  @Output() sortChange = new EventEmitter<DataTableSort>();
  @Output() pageChange = new EventEmitter<DataTablePageChange>();
  @Output() selectionChange = new EventEmitter<string[]>();
  @Output() rowClick = new EventEmitter<Record<string, unknown>>();
  @Output() exportClick = new EventEmitter<void>();
  @Output() filtersChange = new EventEmitter<DataTableFilterState>();

  @ContentChildren(DataTableColumnDirective)
  columnTemplates!: QueryList<DataTableColumnDirective>;

  internalFilters: DataTableFilterState = emptyDataTableFilterState();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters'] && this.filters) {
      this.internalFilters = {
        global: this.filters.global ?? '',
        columns: { ...(this.filters.columns ?? {}) },
      };
    }
  }

  get activeFilters(): DataTableFilterState {
    return this.filters ?? this.internalFilters;
  }

  get filterColumns(): DataTableColumn[] {
    if (!this.filterableColumnsInputs) return [];
    return this.columns.filter((c) => !!c.filter);
  }

  get showGlobalSearch(): boolean {
    return this.filterableColumnsInputs && this.resolveGlobalKeys().length > 0;
  }

  get showFilterBar(): boolean {
    return this.showGlobalSearch || this.filterColumns.length > 0;
  }

  get filteredRows(): Record<string, unknown>[] {
    if (!this.clientFilter) {
      return this.rows as Record<string, unknown>[];
    }
    return applyDataTableFilters(
      this.rows,
      this.columns,
      this.activeFilters,
      this.resolveGlobalKeys()
    );
  }

  get displayRows(): Record<string, unknown>[] {
    if (!this.clientFilter) {
      return this.rows as Record<string, unknown>[];
    }
    const start = (this.page - 1) * this.pageSize;
    return this.filteredRows.slice(start, start + this.pageSize);
  }

  get effectiveTotal(): number {
    return this.clientFilter ? this.filteredRows.length : this.total;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.effectiveTotal / Math.max(this.pageSize, 1)));
  }

  get rangeLabel(): string {
    if (this.effectiveTotal === 0) {
      return 'Sin resultados';
    }
    const from = (this.page - 1) * this.pageSize + 1;
    const to = Math.min(this.page * this.pageSize, this.effectiveTotal);
    return `Mostrando ${from}–${to} de ${this.effectiveTotal}`;
  }

  get allSelected(): boolean {
    if (!this.displayRows.length) {
      return false;
    }
    return this.displayRows.every((r) => this.selectedIds.includes(this.rowId(r)));
  }

  get globalPlaceholder(): string {
    const keys = this.resolveGlobalKeys();
    const labels = keys
      .map((k) => this.columns.find((c) => c.key === k)?.label)
      .filter(Boolean);
    if (!labels.length) return 'Buscar…';
    return `Buscar en ${labels.join(', ')}…`;
  }

  optionsFor(col: DataTableColumn): SearchMultiSelectOption[] {
    if (col.filter?.options?.length) return col.filter.options;
    if (this.filterOptions[col.key]?.length) return this.filterOptions[col.key];
    return deriveFilterOptions(this.rows, col.key);
  }

  textValue(key: string): string {
    const v = this.activeFilters.columns[key];
    return typeof v === 'string' ? v : '';
  }

  multiValue(key: string): string[] {
    const v = this.activeFilters.columns[key];
    return Array.isArray(v) ? (v as string[]) : [];
  }

  dateValue(key: string): DateRangeValue {
    const v = this.activeFilters.columns[key];
    if (v && typeof v === 'object' && !Array.isArray(v) && ('from' in v || 'to' in v)) {
      return v as DateRangeValue;
    }
    return { from: null, to: null };
  }

  onGlobalChange(q: string): void {
    this.patchFilters({ global: q });
  }

  onTextFilter(key: string, value: string): void {
    this.patchColumn(key, value.trim() ? value : null);
  }

  onMultiFilter(key: string, ids: string[]): void {
    this.patchColumn(key, ids.length ? ids : null);
  }

  onDateFilter(key: string, range: DateRangeValue): void {
    const empty = !range.from && !range.to;
    this.patchColumn(key, empty ? null : range);
  }

  clearFilters(): void {
    this.emitFilters(emptyDataTableFilterState());
    if (this.clientFilter) {
      this.pageChange.emit({ page: 1, pageSize: this.pageSize });
    }
  }

  get hasActiveFilters(): boolean {
    const f = this.activeFilters;
    if (f.global.trim()) return true;
    return Object.values(f.columns).some((v) => {
      if (v == null || v === '') return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'object') return !!(v.from || v.to);
      return true;
    });
  }

  rowId(row: Record<string, unknown>): string {
    return String(row[this.rowIdKey] ?? '');
  }

  cellValue(row: Record<string, unknown>, key: string): unknown {
    return row[key];
  }

  templateFor(key: string): DataTableColumnDirective | undefined {
    return this.columnTemplates?.find((t) => t.columnKey === key);
  }

  isSelected(row: Record<string, unknown>): boolean {
    return this.selectedIds.includes(this.rowId(row));
  }

  toggleRow(row: Record<string, unknown>, checked: boolean): void {
    const id = this.rowId(row);
    const next = new Set(this.selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.selectionChange.emit([...next]);
  }

  toggleAll(checked: boolean): void {
    if (!checked) {
      const pageIds = new Set(this.displayRows.map((r) => this.rowId(r)));
      this.selectionChange.emit(this.selectedIds.filter((id) => !pageIds.has(id)));
      return;
    }
    const next = new Set(this.selectedIds);
    for (const r of this.displayRows) {
      next.add(this.rowId(r));
    }
    this.selectionChange.emit([...next]);
  }

  onSort(col: DataTableColumn): void {
    if (!col.sortable) {
      return;
    }
    const direction =
      this.sort?.key === col.key && this.sort.direction === 'asc' ? 'desc' : 'asc';
    this.sortChange.emit({ key: col.key, direction });
  }

  goToPage(page: number): void {
    const p = Math.min(Math.max(1, page), this.totalPages);
    if (p === this.page) {
      return;
    }
    this.pageChange.emit({ page: p, pageSize: this.pageSize });
  }

  onPageSizeChange(size: number): void {
    this.pageChange.emit({ page: 1, pageSize: size });
  }

  trackByRow = (_: number, row: Record<string, unknown>): string => this.rowId(row);

  private resolveGlobalKeys(): string[] {
    if (this.searchableInputMain.length) {
      return this.searchableInputMain;
    }
    return this.columns
      .filter((c) => {
        if (c.searchable === true) return true;
        if (c.searchable === false) return false;
        return c.filter?.type === 'text';
      })
      .map((c) => c.key);
  }

  private patchColumn(key: string, value: DataTableColumnFilterValue): void {
    const columns = { ...this.activeFilters.columns };
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) {
      delete columns[key];
    } else {
      columns[key] = value;
    }
    this.patchFilters({ columns });
  }

  private patchFilters(partial: Partial<DataTableFilterState>): void {
    const next: DataTableFilterState = {
      global: partial.global ?? this.activeFilters.global,
      columns: partial.columns ?? { ...this.activeFilters.columns },
    };
    this.emitFilters(next);
    if (this.clientFilter && this.page !== 1) {
      this.pageChange.emit({ page: 1, pageSize: this.pageSize });
    }
  }

  private emitFilters(next: DataTableFilterState): void {
    this.internalFilters = next;
    this.filtersChange.emit(next);
  }
}
