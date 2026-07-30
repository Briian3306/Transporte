import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErrorValidacionPasada } from '../../models';
import { PeajesMotorTransformacionService } from '../../plantillas/motor/peajes-motor-transformacion.service';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

/**
 * Paso 3 — consume PeajesMotorTransformacion (agente 03).
 * No duplica StrategyRegistry ni estrategias atómicas.
 */
@Component({
  selector: 'app-paso3-transformaciones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './paso3-transformaciones.component.html',
  styleUrl: './paso3-transformaciones.component.css',
})
export class Paso3TransformacionesComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();

  private readonly motor = inject(PeajesMotorTransformacionService);
  readonly state = inject(PeajesWizardStateService);

  errores: ErrorValidacionPasada[] = [];
  previewFilas: Record<string, unknown>[] = [];
  mensaje = '';

  ngOnInit(): void {
    this.aplicarSinConfig();
  }

  /** Sin configuraciones de plantilla: el motor no transforma; valida columnas disponibles. */
  aplicarSinConfig(): void {
    const s = this.state.snapshot();
    const columnas = this.state.columnasParaMapeo();
    this.errores = this.motor.validarDefinicionPlantilla([], columnas);

    const filas = (s.preview?.filasPreview ?? []).map((f) => {
      const out: Record<string, unknown> = {};
      for (const c of columnas) {
        out[c] = f[c];
      }
      return out;
    });

    // Pipeline vacío vía interfaz del motor (sin Strategy local).
    this.previewFilas = this.motor.aplicarPipeline(filas, [], []);
    this.mensaje =
      'Sin transformaciones de plantilla aún. El motor de 03 está cableado; podés continuar al mapeo o aplicar una plantilla en el paso 4.';
  }

  continuar(): void {
    this.completado.emit();
  }
}
