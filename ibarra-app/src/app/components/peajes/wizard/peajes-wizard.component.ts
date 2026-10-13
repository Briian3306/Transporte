import { Component, HostListener, Inject, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  PEAJES_CARGA_SERVICE,
  PEAJES_CATALOGO_SERVICE,
  PeajesCargaService,
  PeajesCatalogoService,
} from '../models';
import {
  PeajesWizardStateService,
  WIZARD_FLUJO_ORDEN,
  WizardPasoId,
  anteriorPaso,
  indiceFlujo,
  numeroVisualPaso,
  puedeAvanzarFlujo,
  siguientePaso,
} from './services/peajes-wizard-state.service';
import { PlantillaExcepcionPaso } from './services/peajes-plantilla-apply.service';
import { PeajesPlantillaApplyService } from './services/peajes-plantilla-apply.service';
import { Paso1CargaComponent } from './paso1-carga/paso1-carga.component';
import { Paso2PreviewComponent } from './paso2-preview/paso2-preview.component';
import { Paso3TransformacionesComponent } from './paso3-transformaciones/paso3-transformaciones.component';
import { Paso4PlantillaComponent } from './paso4-plantilla/paso4-plantilla.component';
import { Paso5MapeoComponent } from './paso5-mapeo/paso5-mapeo.component';
import { Paso6EstacionesComponent } from './paso6-estaciones/paso6-estaciones.component';
import { Paso7FacturaComponent } from './paso7-factura/paso7-factura.component';
import { Paso8ValidacionComponent } from './paso8-validacion/paso8-validacion.component';
import { Paso9RevisionComponent } from './paso9-revision/paso9-revision.component';
import { PEAJES_SUPABASE_PROVIDERS } from '../peajes.providers';
import { PEAJES_WIZARD_ADVANCE_EVENT } from './wizard-keyboard';

interface PasoMeta {
  id: WizardPasoId;
  label: string;
  numero: number;
}

const PASO_LABELS: Record<WizardPasoId, string> = {
  1: 'Cargar archivo',
  2: 'Previsualizar',
  3: 'Transformaciones',
  4: 'Plantilla',
  5: 'Mapear columnas',
  6: 'Estaciones',
  7: 'Documento',
  8: 'Validación',
  9: 'Revisar',
};

const PASOS: PasoMeta[] = WIZARD_FLUJO_ORDEN.map((id) => ({
  id,
  label: PASO_LABELS[id],
  numero: numeroVisualPaso(id),
}));

@Component({
  selector: 'app-peajes-wizard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    Paso1CargaComponent,
    Paso2PreviewComponent,
    Paso3TransformacionesComponent,
    Paso4PlantillaComponent,
    Paso5MapeoComponent,
    Paso6EstacionesComponent,
    Paso7FacturaComponent,
    Paso8ValidacionComponent,
    Paso9RevisionComponent,
  ],
  providers: [...PEAJES_SUPABASE_PROVIDERS, PeajesPlantillaApplyService],
  templateUrl: './peajes-wizard.component.html',
  styleUrl: './peajes-wizard.component.css',
  // Los pasos son componentes standalone: el shell provee el kit .pw__* para todos sus hijos.
  // El selector raíz .pw mantiene estas reglas aisladas del resto de la aplicación.
  encapsulation: ViewEncapsulation.None,
})
export class PeajesWizardComponent implements OnInit {
  readonly state = inject(PeajesWizardStateService);
  readonly pasos = PASOS;

  /** DI tipada contra contratos Fase 0 (servicios Supabase F01). */
  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) readonly catalogo: PeajesCatalogoService,
    @Inject(PEAJES_CARGA_SERVICE) readonly carga: PeajesCargaService
  ) {}

  ngOnInit(): void {
    // Estado ya hidratado desde el servicio (RF-25).
  }

  get pasoActual(): WizardPasoId {
    return this.state.pasoActual;
  }

  @HostListener('document:keydown', ['$event'])
  onWizardKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    const shiftNav =
      event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && !this.isEditableTarget(event.target);
    // Alt+Arrow works inside inputs (Shift+Arrow keeps native text selection).
    const altNav = event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey;
    if (!shiftNav && !altNav) {
      return;
    }

    event.preventDefault();
    if (event.key === 'ArrowLeft') {
      this.atras();
      return;
    }

    const next = siguientePaso(this.pasoActual);
    if (next !== this.pasoActual && this.puedeAvanzarA(next)) {
      this.state.setPaso(next);
      return;
    }
    // Ask the active step to validate/commit (e.g. Paso 7 factura form).
    document.dispatchEvent(new CustomEvent(PEAJES_WIZARD_ADVANCE_EVENT));
  }

  irA(paso: WizardPasoId): void {
    if (indiceFlujo(paso) <= indiceFlujo(this.pasoActual) || this.puedeAvanzarA(paso)) {
      this.state.setPaso(paso);
    }
  }

  siguiente(): void {
    const next = siguientePaso(this.pasoActual);
    if (next !== this.pasoActual && this.puedeAvanzarA(next)) {
      this.state.setPaso(next);
    }
  }

  atras(): void {
    const prev = anteriorPaso(this.pasoActual);
    if (prev !== this.pasoActual) {
      this.state.setPaso(prev);
    }
  }

  /** Estaciones (6) se resuelven después de elegir empresa en Documento. */
  onExcepcionPlantilla(paso: PlantillaExcepcionPaso): void {
    this.state.setPaso(paso === 6 ? 7 : paso);
  }

  pasoHecho(paso: WizardPasoId): boolean {
    return indiceFlujo(paso) < indiceFlujo(this.pasoActual);
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (target.isContentEditable) return true;
    return !!target.closest('[contenteditable="true"]');
  }

  puedeAvanzarA(paso: WizardPasoId): boolean {
    return puedeAvanzarFlujo(paso, this.state.snapshot());
  }

  reiniciar(): void {
    this.state.reiniciar();
  }
}
