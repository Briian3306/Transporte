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
  seleccionada: string | null = null;

  get mapeos(): MapeoColumna[] {
    return this.state.mapeosActivos();
  }

  get mapeoSeleccionado(): MapeoColumna | null {
    if (!this.seleccionada) {
      return this.mapeos[0] ?? null;
    }
    return this.mapeos.find((m) => m.columnaOrigen === this.seleccionada) ?? this.mapeos[0] ?? null;
  }

  etiquetaOrigen(col: string): string {
    if (col.toUpperCase() === 'FECHA') {
      return 'FECHA + HORA';
    }
    return col;
  }

  descripcionTransform(m: MapeoColumna): string {
    const dest = m.columnaDestino;
    const map: Record<string, string> = {
      FECHA_HORA: 'Completar HORA · combinar columnas',
      PASE_ID: 'Convertir a texto · limpiar',
      PATENTE_ID: 'Eliminar guiones · mayúsculas',
      ESTACION_ID: 'Buscar catálogo interno',
      PRECIO: 'Número decimal',
      BONIFICACION: 'Número decimal',
      QUANTITY: 'Asignar 1',
      IMPORTE_NETO: 'Calcular diferencia',
    };
    if (dest && map[dest]) {
      return map[dest];
    }
    return dest ? 'Mapear columna' : 'Sin transformación';
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
    // QUANTITY e IMPORTE_NETO se generan al estandarizar
    return this.obligatorias.filter(
      (k) => !mapeados.has(k) && k !== 'QUANTITY' && k !== 'IMPORTE_NETO'
    );
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
