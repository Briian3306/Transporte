import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DataTableColumn,
  DataTableColumnDirective,
  DataTableComponent,
} from '../../shared';
import {
  AuditoriaEstacionRow,
  EstadoCasoAuditoriaEstacion,
} from '../models/auditoria-estaciones.contracts';

const ESTADO_OPTIONS: { id: EstadoCasoAuditoriaEstacion; label: string }[] = [
  { id: 'VALIDADO', label: 'Validar (bien)' },
  { id: 'DESCARTADO', label: 'Descartar (mal)' },
  { id: 'REQUIERE_CORRECCION', label: 'Marcar para corregir' },
];

@Component({
  selector: 'app-auditoria-estacion-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, DataTableColumnDirective],
  templateUrl: './auditoria-estacion-panel.component.html',
  styleUrl: './auditoria-estacion-panel.component.css',
})
export class AuditoriaEstacionPanelComponent {
  @Input({ required: true }) row!: AuditoriaEstacionRow;
  @Input() saving = false;
  @Input() confirmError: string | null = null;
  @Output() confirmar = new EventEmitter<{
    estado: EstadoCasoAuditoriaEstacion;
    observacion: string | null;
  }>();
  @Output() verCasos = new EventEmitter<AuditoriaEstacionRow>();
  @Output() corregir = new EventEmitter<AuditoriaEstacionRow>();

  observacion = '';
  selected: EstadoCasoAuditoriaEstacion | null = null;
  readonly estadoOptions = ESTADO_OPTIONS;

  readonly columns: DataTableColumn[] = [
    { key: 'codigo', label: 'Código', sortable: false },
    { key: 'fuente', label: 'Fuente', sortable: false },
    { key: 'acciones', label: 'Acciones', sortable: false },
  ];

  get tableRows(): Record<string, unknown>[] {
    return this.row.codigosEstacion.map((codigo) => ({
      codigo,
      fuente: this.row.fuentes.join(', ') || 'catálogo',
    }));
  }

  onConfirm(): void {
    if (!this.selected) return;
    this.confirmar.emit({
      estado: this.selected,
      observacion: this.observacion.trim() || null,
    });
  }
}
