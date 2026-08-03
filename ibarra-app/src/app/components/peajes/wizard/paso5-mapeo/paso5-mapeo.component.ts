import { Component, EventEmitter, Inject, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MapeoColumna,
  PEAJES_CATALOGO_SERVICE,
  PASADA_COLUMNAS_OBLIGATORIAS,
  PASADA_COLUMN_KEYS,
  PasadaColumnKey,
  PeajesCatalogoService,
} from '../../models';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-paso5-mapeo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paso5-mapeo.component.html',
  styleUrl: './paso5-mapeo.component.css',
})
export class Paso5MapeoComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();

  readonly state = inject(PeajesWizardStateService);
  readonly destinos = PASADA_COLUMN_KEYS;
  readonly obligatorias = PASADA_COLUMNAS_OBLIGATORIAS;

  error: string | null = null;
  seleccionada: string | null = null;
  resolviendoPatentes = false;

  constructor(@Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService) {}

  ngOnInit(): void {
    this.state.asegurarMapeosObligatorios();
  }

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
    if (this.esSalidaPipeline(col)) {
      return `${col} (pipeline)`;
    }
    return col;
  }

  esSalidaPipeline(col: string): boolean {
    return this.state.columnasGeneradasPipeline().includes(col);
  }

  descripcionTransform(m: MapeoColumna): string {
    const dest = m.columnaDestino;
    if (this.esSalidaPipeline(m.columnaOrigen)) {
      return dest
        ? `Salida del pipeline → ${dest}`
        : 'Salida del pipeline (elegí destino estándar)';
    }
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

  async continuar(): Promise<void> {
    const faltan = this.faltantes();
    if (faltan.length) {
      this.error = `Columnas obligatorias sin mapear: ${faltan.join(', ')}`;
      return;
    }
    this.resolviendoPatentes = true;
    try {
      const patentes = await firstValueFrom(this.catalogo.listarPatentes());
      const porPatente = new Map<string, string>();
      for (const patente of patentes) {
        porPatente.set(this.normalizarPatente(patente.patente), patente.id);
        // Si una plantilla ya devolvió el UUID, se conserva sin intentar normalizarlo como dominio.
        porPatente.set(patente.id, patente.id);
      }
      const pasadas = this.state.construirPasadasDesdeMapeo();
      const faltantesPatente = new Set<string>();
      for (const pasada of pasadas) {
        const clave = this.normalizarPatente(pasada.PATENTE_ID);
        const patenteId = porPatente.get(clave);
        if (!patenteId) {
          faltantesPatente.add(clave || '(vacía)');
        } else {
          pasada.PATENTE_ID = patenteId;
        }
      }
      if (faltantesPatente.size) {
        this.error = `Patentes sin resolver en el catálogo: ${[...faltantesPatente].slice(0, 5).join(', ')}${faltantesPatente.size > 5 ? '…' : ''}`;
        return;
      }
      this.state.setPasadasEstandarizadas(pasadas);
      this.completado.emit();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo consultar el catálogo de patentes.';
    } finally {
      this.resolviendoPatentes = false;
    }
  }

  private normalizarPatente(valor: unknown): string {
    return String(valor ?? '').replace(/[\s-]/g, '').toUpperCase();
  }
}
