import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

@Component({
  selector: 'app-paso2-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paso2-preview.component.html',
  styleUrl: './paso2-preview.component.css',
})
export class Paso2PreviewComponent {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();

  readonly state = inject(PeajesWizardStateService);

  get preview() {
    return this.state.snapshot().preview;
  }

  get filasPreview() {
    return this.preview?.filasPreview.slice(0, 10) ?? [];
  }

  incluida(col: string): boolean {
    return this.state.snapshot().columnasIncluidas.includes(col);
  }

  toggleColumna(col: string, checked: boolean): void {
    const s = this.state.snapshot();
    let incluidas = [...s.columnasIncluidas];
    let excluidas = [...s.columnasExcluidas];

    if (checked) {
      excluidas = excluidas.filter((c) => c !== col);
      if (!incluidas.includes(col)) {
        incluidas.push(col);
      }
    } else {
      incluidas = incluidas.filter((c) => c !== col);
      if (!excluidas.includes(col)) {
        excluidas.push(col);
      }
    }
    this.state.setSeleccionColumnas(incluidas, excluidas);
  }

  columnasVacias(col: string): number {
    return this.filasPreview.filter((r) => r[col] === null || r[col] === undefined || r[col] === '').length;
  }

  continuar(): void {
    const s = this.state.snapshot();
    if (!s.preview || s.columnasIncluidas.length === 0) {
      return;
    }
    this.completado.emit();
  }
}
