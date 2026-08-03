import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';
import { ColumnRecommendation } from '../services/column-recognition';

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

  get recomendacionesVisibles(): ColumnRecommendation[] {
    return this.state
      .snapshot()
      .recomendaciones.filter((r) => r.status === 'pending' || r.status === 'accepted');
  }

  get pendientesCount(): number {
    return this.state.recomendacionesPendientes().length;
  }

  incluida(col: string): boolean {
    return this.state.snapshot().columnasIncluidas.includes(col);
  }

  columnaConRecomendacion(col: string): boolean {
    const upper = col.toUpperCase();
    return this.state
      .recomendacionesPendientes()
      .some((r) => r.columnasEntrada.some((c) => c.toUpperCase() === upper));
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

  esMono(col: string): boolean {
    const u = col.toUpperCase();
    return u === 'DISPOSITIVON' || u === 'TARIFA' || u === 'BONIFICACION' || u === 'HORA';
  }

  aplicarRecomendacion(id: string): void {
    this.state.aceptarRecomendacion(id);
  }

  descartarRecomendacion(id: string): void {
    this.state.descartarRecomendacion(id);
  }

  aplicarTodas(): void {
    this.state.aceptarTodasRecomendaciones();
  }

  continuar(): void {
    const s = this.state.snapshot();
    if (!s.preview || s.columnasIncluidas.length === 0) {
      return;
    }
    this.completado.emit();
  }
}
