import { Component, Inject, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  PEAJES_CARGA_SERVICE,
  PEAJES_CATALOGO_SERVICE,
  PeajesCargaService,
  PeajesCatalogoService,
} from '../models';
import { PeajesWizardStateService, WizardPasoId } from './services/peajes-wizard-state.service';
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

interface PasoMeta {
  id: WizardPasoId;
  label: string;
  owner?: string;
}

const PASOS: PasoMeta[] = [
  { id: 1, label: 'Cargar archivo' },
  { id: 2, label: 'Previsualizar' },
  { id: 3, label: 'Transformaciones' },
  { id: 4, label: 'Plantilla' },
  { id: 5, label: 'Mapear columnas' },
  { id: 6, label: 'Estaciones' },
  { id: 7, label: 'Factura' },
  { id: 8, label: 'Validación' },
  { id: 9, label: 'Revisar' },
];

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
  providers: PEAJES_SUPABASE_PROVIDERS,
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

  irA(paso: WizardPasoId): void {
    if (paso < this.pasoActual || this.puedeAvanzarA(paso)) {
      this.state.setPaso(paso);
    }
  }

  siguiente(): void {
    const next = Math.min(9, this.pasoActual + 1) as WizardPasoId;
    if (this.puedeAvanzarA(next)) {
      this.state.setPaso(next);
    }
  }

  atras(): void {
    if (this.pasoActual > 1) {
      this.state.setPaso((this.pasoActual - 1) as WizardPasoId);
    }
  }

  puedeAvanzarA(paso: WizardPasoId): boolean {
    const s = this.state.snapshot();
    if (paso >= 2 && (!s.preview || !s.empresaId)) {
      return false;
    }
    if (paso >= 5 && s.columnasIncluidas.length === 0) {
      return false;
    }
    if (paso >= 6 && s.pasadasEstandarizadas.length === 0) {
      return false;
    }
    if (paso >= 7 && (!s.relacionesEstacion.length || s.relacionesEstacion.some((r) => !r.estacionId))) {
      return false;
    }
    if (paso >= 8) {
      const f = s.factura;
      if (!f.factura || !f.empresa_id || !f.fecha_factura ||
          f.importe_sin_iva === null || f.importe_total === null) {
        return false;
      }
    }
    if (paso >= 9 && (!s.validacion || s.validacion.errores.length > 0 || !s.validacion.dentroTolerancia)) {
      return false;
    }
    return true;
  }

  reiniciar(): void {
    this.state.reiniciar();
  }
}
