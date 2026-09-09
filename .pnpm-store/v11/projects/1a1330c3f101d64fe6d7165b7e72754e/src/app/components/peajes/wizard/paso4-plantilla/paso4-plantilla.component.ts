import { Component, EventEmitter, Inject, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  PEAJES_PLANTILLAS_SERVICE,
  PlantillaConfiguracion,
  PeajesPlantillasService,
  PasadaEstandarizada,
} from '../../models';
import { PeajesMotorTransformacionService } from '../../plantillas/motor/peajes-motor-transformacion.service';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';
import {
  PeajesPlantillaApplyService,
  PlantillaExcepcionPaso,
} from '../services/peajes-plantilla-apply.service';

/**
 * Paso 4 — selecciona/aplica plantilla vía PeajesPlantillaApplyService + motor.
 * Si hay draft del Paso 3, lo aplica a filasOrigen cuando no hay plantilla remota.
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
  /** Salto controlado: solo cuando plantilla + catálogos dejan cero excepciones. */
  @Output() facturaDirecta = new EventEmitter<void>();
  /** Excepción tras aplicar: Paso 5 (mapeos/patentes) o Paso 6 (estaciones). */
  @Output() irAExcepcion = new EventEmitter<PlantillaExcepcionPaso>();

  private readonly motor = inject(PeajesMotorTransformacionService);
  private readonly plantillaApply = inject(PeajesPlantillaApplyService);
  readonly state = inject(PeajesWizardStateService);

  constructor(
    @Inject(PEAJES_PLANTILLAS_SERVICE) private readonly plantillasSvc: PeajesPlantillasService
  ) {}

  plantillas: PlantillaConfiguracion[] = [];
  plantillaId = '';
  errores: string[] = [];
  info = 'Podés continuar sin plantilla.';

  async ngOnInit(): Promise<void> {
    this.plantillas = await firstValueFrom(this.plantillasSvc.listarPlantillas());
    const snap = this.state.snapshot();
    const prev = snap.plantillaId;
    if (prev) {
      this.plantillaId = prev;
    }
    const draftCount = snap.configuracionesDraft.length;
    if (draftCount > 0 && !prev) {
      this.info = `Hay un pipeline draft del paso 3 (${draftCount} pasos). Se aplicará al continuar si no elegís otra plantilla.`;
    }
  }

  get tieneDraft(): boolean {
    return this.state.snapshot().configuracionesDraft.length > 0;
  }

  private filasParaMotor(columnas: string[]): Record<string, unknown>[] {
    const s = this.state.snapshot();
    const origen =
      s.preview?.filasOrigen?.length
        ? s.preview.filasOrigen
        : (s.preview?.filasPreview ?? []);
    return origen.map((f) => {
      const out: Record<string, unknown> = {};
      for (const c of columnas) {
        out[c] = f[c];
      }
      for (const [k, v] of Object.entries(f)) {
        if (!(k in out)) out[k] = v;
      }
      return out;
    });
  }

  private aplicarDraftPipeline(): PasadaEstandarizada[] | null {
    const configs = this.state.toConfiguracionesPlantilla();
    if (!configs.length) return null;
    const columnas = this.state.columnasParaMapeo();
    const erroresValidacion = this.motor.validarDependenciasPipeline(configs, columnas);
    if (erroresValidacion.length) {
      this.errores = erroresValidacion.map(
        (e) => `${e.columna}: ${e.motivo} (valor: ${e.valor})`
      );
      return null;
    }
    const filas = this.filasParaMotor(columnas);
    return this.motor.aplicarPipeline(filas, configs);
  }

  async continuar(): Promise<void> {
    this.errores = [];
    if (!this.plantillaId) {
      this.state.setPlantillaId(null);
      if (this.tieneDraft) {
        const transformadas = this.aplicarDraftPipeline();
        if (!transformadas) {
          if (!this.errores.length) {
            this.errores.push('No se pudo aplicar el pipeline draft.');
          }
          return;
        }
        this.state.setPasadasEstandarizadas(transformadas);
        this.info = `Pipeline draft aplicado (${transformadas.length} filas).`;
      } else {
        this.info = 'Sin plantilla: se continúa con columnas crudas / mapeo posterior.';
      }
      this.completado.emit();
      return;
    }

    const result = await this.plantillaApply.aplicarYEvaluar(this.plantillaId);
    this.info = result.mensaje;
    if (!result.ok) {
      this.errores = result.errores;
      return;
    }
    if (result.excepcion === null) {
      this.facturaDirecta.emit();
      return;
    }
    this.irAExcepcion.emit(result.excepcion);
  }

  async continuarSinPlantilla(): Promise<void> {
    this.plantillaId = '';
    this.state.setPlantillaId(null);
    this.errores = [];
    if (this.tieneDraft) {
      const transformadas = this.aplicarDraftPipeline();
      if (!transformadas) {
        if (!this.errores.length) {
          this.errores.push('No se pudo aplicar el pipeline draft.');
        }
        return;
      }
      this.state.setPasadasEstandarizadas(transformadas);
      this.info = `Continuando con pipeline draft (${transformadas.length} filas).`;
    }
    this.completado.emit();
  }
}
