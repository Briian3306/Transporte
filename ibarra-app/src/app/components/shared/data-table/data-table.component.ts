import {
  Component,
  ContentChildren,
  EventEmitter,
  Input,
  Output,
  QueryList,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTableColumnDirective } from './data-table-column.directive';
import {
  DataTableColumn,
  DataTablePageChange,
  DataTableSort,
} from './data-table.types';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css',
})
export class DataTableComponent {
  @Input({ required: true }) columns: DataTableColumn[] = [];
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

  @Output() sortChange = new EventEmitter<DataTableSort>();
  @Output() pageChange = new EventEmitter<DataTablePageChange>();
  @Output() selectionChange = new EventEmitter<string[]>();
  @Output() rowClick = new EventEmitter<Record<string, unknown>>();
  @Output() exportClick = new EventEmitter<void>();

  @ContentChildren(DataTableColumnDirective)
  columnTemplates!: QueryList<DataTableColumnDirective>;

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / Math.max(this.pageSize, 1)));
  }

  get rangeLabel(): string {
    if (this.total === 0) {
      return 'Sin resultados';
    }
    const from = (this.page - 1) * this.pageSize + 1;
    const to = Math.min(this.page * this.pageSize, this.total);
    return `Mostrando ${from}–${to} de ${this.total}`;
  }

  get allSelected(): boolean {
    if (!this.rows.length) {
      return false;
    }
    return this.rows.every((r) => this.selectedIds.includes(this.rowId(r)));
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
      const pageIds = new Set(this.rows.map((r) => this.rowId(r)));
      this.selectionChange.emit(this.selectedIds.filter((id) => !pageIds.has(id)));
      return;
    }
    const next = new Set(this.selectedIds);
    for (const r of this.rows) {
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
}
