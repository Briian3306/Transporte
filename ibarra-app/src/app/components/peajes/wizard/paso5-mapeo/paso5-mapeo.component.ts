import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MapeoColumna,
  PASADA_COLUMNAS_OBLIGATORIAS,
  PASADA_COLUMN_KEYS,
  PasadaColumnKey,
} from '../../models';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

@Component({
  selector: 'app-paso5-mapeo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paso5-mapeo.component.html',
  styleUrl: './paso5-mapeo.component.css',
})
export class Paso5MapeoComponent {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();

  readonly state = inject(PeajesWizardStateService);
  readonly destinos = PASADA_COLUMN_KEYS;
  readonly obligatorias = PASADA_COLUMNAS_OBLIGATORIAS;

  error: string | null = null;

  get mapeos(): MapeoColumna[] {
    return this.state.mapeosActivos();
  }

  setDestino(columnaOrigen: string, destino: string): void {
    const all = this.state.snapshot().mapeos.map((m) => {
      if (m.columnaOrigen !== columnaOrigen) {
        return { ...m };
      }
      return {
        ...m,
        columnaDestino: destino ? (destino as PasadaColumnKey) : null,
      };
    });
    this.state.setMapeos(all);
    this.error = null;
  }

  destinoUsado(key: PasadaColumnKey, exceptoOrigen: string): boolean {
    return this.mapeos.some(
      (m) => m.columnaDestino === key && m.columnaOrigen !== exceptoOrigen
    );
  }

  faltantes(): PasadaColumnKey[] {
    const mapeados = new Set(
      this.mapeos.filter((m) => m.columnaDestino).map((m) => m.columnaDestino!)
    );
    return this.obligatorias.filter((k) => !mapeados.has(k));
  }

  continuar(): void {
    const faltan = this.faltantes();
    if (faltan.length) {
      this.error = `Columnas obligatorias sin mapear: ${faltan.join(', ')}`;
      return;
    }
    this.state.setPasadasEstandarizadas(this.state.construirPasadasDesdeMapeo());
    this.completado.emit();
  }
}
