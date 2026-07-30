import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { PlantillaConfiguracion } from '../../models';
import { PeajesMotorTransformacionService } from '../../plantillas/motor/peajes-motor-transformacion.service';
import { PeajesPlantillasMockService } from '../../plantillas/mocks/peajes-plantillas.mock';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

/**
 * Paso 4 — selecciona/aplica plantilla vía mock 03 + motor (sin duplicar Strategy).
 */
@Component({
  selector: 'app-paso4-plantilla',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paso4-plantilla.component.html',
  styleUrl: './paso4-plantilla.component.css',
})
export class Paso4PlantillaComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();

  private readonly plantillasSvc = inject(PeajesPlantillasMockService);
  private readonly motor = inject(PeajesMotorTransformacionService);
  readonly state = inject(PeajesWizardStateService);

  plantillas: PlantillaConfiguracion[] = [];
  plantillaId = '';
  errores: string[] = [];
  info = 'Podés continuar sin plantilla.';

  async ngOnInit(): Promise<void> {
    this.plantillas = await firstValueFrom(this.plantillasSvc.listarPlantillas());
    const prev = this.state.snapshot().plantillaId;
    if (prev) {
      this.plantillaId = prev;
    }
  }

  async aplicarSeleccionada(): Promise<void> {
    this.errores = [];
    if (!this.plantillaId) {
      this.state.setPlantillaId(null);
      this.info = 'Sin plantilla: se continúa con columnas crudas.';
      return;
    }

    const plantilla = await firstValueFrom(this.plantillasSvc.obtenerPlantilla(this.plantillaId));
    if (!plantilla) {
      this.errores.push('Plantilla no encontrada');
      return;
    }

    const configs = plantilla.configuraciones ?? [];
    const columnas = this.state.columnasParaMapeo();
    const erroresValidacion = this.motor.validarDefinicionPlantilla(configs, columnas);
    if (erroresValidacion.length) {
      this.errores = erroresValidacion.map(
        (e) => `${e.columna}: ${e.motivo} (valor: ${e.valor})`
      );
      return;
    }

    const s = this.state.snapshot();
    const filas = (s.preview?.filasPreview ?? []).map((f) => {
      const out: Record<string, unknown> = {};
      for (const c of columnas) {
        out[c] = f[c];
      }
      return out;
    });

    const algoritmos = await firstValueFrom(this.plantillasSvc.listarAlgoritmos());
    const transformadas = this.motor.aplicarPipeline(filas, configs, algoritmos);
    this.state.setPasadasEstandarizadas(transformadas);
    this.state.setPlantillaId(plantilla.id);
    this.info = `Plantilla «${plantilla.nombre}» aplicada vía motor (${transformadas.length} filas preview).`;
  }

  async continuar(): Promise<void> {
    await this.aplicarSeleccionada();
    if (this.errores.length) {
      return;
    }
    this.completado.emit();
  }

  continuarSinPlantilla(): void {
    this.state.setPlantillaId(null);
    this.completado.emit();
  }
}
