import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DialogComponent } from '../../shared';
import { TarifarioHistorialItem } from '../models/tarifario.contracts';
import { MISSING_IMPORTE_LABEL, formatTarifaImporteDisplay } from './tarifario.helpers';

const UNKNOWN_DATE_LABEL = 'Sin fecha conocida';

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

  formatVigencia(iso: string | null | undefined): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? '').trim());
    return match ? `${match[3]}/${match[2]}/${match[1]}` : UNKNOWN_DATE_LABEL;
  }

  formatDiagnostico(value: string | null | undefined): string {
    const text = value?.trim();
    return text ? text : this.missing;
  }

  formatCategoriaCalculada(value: number | null | undefined): string {
    return value == null ? this.missing : String(value);
  }

  formatImporte(n: number): string {
    return formatTarifaImporteDisplay(n);
  }
}
