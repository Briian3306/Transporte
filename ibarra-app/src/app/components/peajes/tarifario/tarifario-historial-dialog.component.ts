import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DialogComponent } from '../../shared';
import { TarifarioHistorialItem } from '../models/tarifario.contracts';
import { MISSING_IMPORTE_LABEL, formatFechaActualizacion, formatTarifaImporteDisplay } from './tarifario.helpers';

@Component({
  selector: 'app-tarifario-historial-dialog',
  standalone: true,
  imports: [CommonModule, DialogComponent],
  templateUrl: './tarifario-historial-dialog.component.html',
  styleUrls: ['../shared/peajes-list-shell.css'],
})
export class TarifarioHistorialDialogComponent {
  @Input() open = false;
  @Input() title = 'Historial';
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() rows: TarifarioHistorialItem[] = [];
  @Output() closed = new EventEmitter<void>();

  readonly missing = MISSING_IMPORTE_LABEL;

  formatFecha(iso: string): string {
    return formatFechaActualizacion(iso);
  }

  formatImporte(n: number): string {
    return formatTarifaImporteDisplay(n);
  }
}
