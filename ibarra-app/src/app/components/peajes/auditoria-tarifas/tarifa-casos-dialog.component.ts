import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DataTableColumn,
  DataTableColumnDirective,
  DataTableComponent,
  DataTablePageChange,
  DataTableSort,
  DialogComponent,
} from '../../shared';
import { PasadaGestion, stationBadgeFromCoords } from '../models';
import { formatUtcDateTime } from '../wizard/services/peajes-fecha.util';

@Component({
  selector: 'app-tarifa-casos-dialog',
  standalone: true,
  imports: [CommonModule, DialogComponent, DataTableComponent, DataTableColumnDirective],
  templateUrl: './tarifa-casos-dialog.component.html',
  styleUrl: './tarifa-casos-dialog.component.css',
})
export class TarifaCasosDialogComponent {
  @Input() open = false;
  @Input() title = 'Pasadas';
  @Input() description = '';
  @Input() rows: PasadaGestion[] = [];
  @Input() total = 0;
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() page = 1;
  @Input() pageSize = 50;
  @Input() sort: DataTableSort = { key: 'fecha_hora', direction: 'desc' };

  @Output() closed = new EventEmitter<void>();
  @Output() sortChange = new EventEmitter<DataTableSort>();
  @Output() pageChange = new EventEmitter<DataTablePageChange>();

  readonly columns: DataTableColumn[] = [
    { key: 'fecha_hora', label: 'Fecha', sortable: true, width: '11rem' },
    { key: 'estacion_nombre', label: 'Estación', sortable: true },
    { key: 'patente_codigo', label: 'Patente', sortable: true, width: '8rem' },
    { key: 'empresa_nombre', label: 'Empresa', sortable: true },
    { key: 'precio', label: 'Precio', sortable: true, align: 'right', width: '7rem' },
    { key: 'importe_neto', label: 'Neto', sortable: true, align: 'right', width: '7rem' },
    { key: 'file_upload_name', label: 'Archivo', sortable: true },
    { key: 'created_at', label: 'Creado', sortable: true, width: '10rem' },
  ];

  get tableRows(): Record<string, unknown>[] {
    return this.rows as unknown as Record<string, unknown>[];
  }

  asPasada(row: Record<string, unknown>): PasadaGestion {
    return row as unknown as PasadaGestion;
  }

  badge(row: PasadaGestion | Record<string, unknown>): 'OK' | 'PENDING' {
    const r = row as PasadaGestion;
    return stationBadgeFromCoords(r.estacion_latitud, r.estacion_longitud);
  }

  formatFechaHora(value: string | null | undefined, withSeconds = true): string {
    return formatUtcDateTime(value, withSeconds);
  }

  onClose(): void {
    this.closed.emit();
  }
}
