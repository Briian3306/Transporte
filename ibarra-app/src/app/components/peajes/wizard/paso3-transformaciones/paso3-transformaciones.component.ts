import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErrorValidacionPasada } from '../../models';
import { PeajesMotorTransformacionService } from '../../plantillas/motor/peajes-motor-transformacion.service';
import {
  MVP_TRANSFORM_SPECS,
  aplicarTransformPreview,
} from '../fixtures/mvp-ejemplo.fixture';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

/**
 * Paso 3 — consume PeajesMotorTransformacion (agente 03).
 * UI alineada al mockup: tarjetas de transformación + preview entrada/salida.
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

  readonly specs = MVP_TRANSFORM_SPECS;
  selectedKey = 'FECHA_HORA';

  errores: ErrorValidacionPasada[] = [];
  mensaje = '';
  filas: Record<string, unknown>[] = [];

  ngOnInit(): void {
    this.aplicarSinConfig();
  }

  get tieneColumnasMvp(): boolean {
    const cols = new Set((this.state.snapshot().preview?.columnas ?? []).map((c) => c.toUpperCase()));
    return ['FECHA', 'HORA', 'DOMINIO', 'DISPOSITIVON', 'TARIFA', 'BONIFICACION'].every((c) =>
      cols.has(c)
    );
  }

  get specActiva() {
    return this.specs.find((s) => s.key === this.selectedKey) ?? this.specs[0];
  }

  aplicarSinConfig(): void {
    const s = this.state.snapshot();
    const columnas = this.state.columnasParaMapeo();
    this.errores = this.motor.validarDefinicionPlantilla([], columnas);

    this.filas = (s.preview?.filasPreview ?? []).slice(0, 10).map((f) => ({ ...f }));
    this.mensaje = this.tieneColumnasMvp
      ? 'Columnas del ejemplo detectadas. Revisá las transformaciones antes de continuar.'
      : 'Sin plantilla aún. Podés continuar al mapeo o aplicar una plantilla en el paso 4.';
  }

  salida(key: string, fila: Record<string, unknown>): string {
    return aplicarTransformPreview(key, fila);
  }

  continuar(): void {
    this.completado.emit();
  }
}
