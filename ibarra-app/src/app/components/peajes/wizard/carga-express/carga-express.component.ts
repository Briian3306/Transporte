import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PEAJES_SUPABASE_PROVIDERS } from '../../peajes.providers';
import { Paso1CargaComponent } from '../paso1-carga/paso1-carga.component';
import { Paso6EstacionesComponent } from '../paso6-estaciones/paso6-estaciones.component';
import { Paso7FacturaComponent } from '../paso7-factura/paso7-factura.component';
import { Paso8ValidacionComponent } from '../paso8-validacion/paso8-validacion.component';
import { Paso9RevisionComponent } from '../paso9-revision/paso9-revision.component';
import { PatentesExpressComponent } from './patentes-express.component';
import { PeajesPlantillaApplyService, PlantillaExcepcionPaso } from '../services/peajes-plantilla-apply.service';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

type CargaExpressPasoId = 1 | 5 | 6 | 7 | 8 | 9;

interface CargaExpressPasoMeta {
  id: 1 | 5 | 6 | 7 | 9;
  numero: number;
  label: string;
}

@Component({
  selector: 'app-peajes-carga-express',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    Paso1CargaComponent,
    PatentesExpressComponent,
    Paso6EstacionesComponent,
    Paso7FacturaComponent,
    Paso8ValidacionComponent,
    Paso9RevisionComponent,
  ],
  providers: [...PEAJES_SUPABASE_PROVIDERS, PeajesPlantillaApplyService],
  templateUrl: './carga-express.component.html',
  styleUrls: ['./../peajes-wizard.component.css', './carga-express.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class PeajesCargaExpressComponent implements OnInit {
  readonly state = inject(PeajesWizardStateService);
  private readonly plantillaApply = inject(PeajesPlantillaApplyService);
  pasoActual: CargaExpressPasoId = 1;
  error: string | null = null;
  private mostrarPatentes = false;
  private mostrarEstaciones = false;

  get pasos(): CargaExpressPasoMeta[] {
    const pasos: CargaExpressPasoMeta[] = [{ id: 1, numero: 1, label: 'Cargar archivo' }];
    if (this.mostrarPatentes) pasos.push({ id: 5, numero: 0, label: 'Patentes' });
    if (this.mostrarEstaciones) pasos.push({ id: 6, numero: 0, label: 'Estaciones' });
    pasos.push({ id: 7, numero: 0, label: 'Factura' }, { id: 9, numero: 0, label: 'Revisar y guardar' });
    return pasos.map((paso, index) => ({ ...paso, numero: index + 1 }));
  }

  ngOnInit(): void {
    this.state.reiniciar();
  }

  get mostrarValidacion(): boolean {
    return this.pasoActual === 8;
  }

  get pasoVisualActual(): number {
    return this.pasos.find((paso) => paso.id === this.pasoActual)?.numero ?? 3;
  }

  onCargaCompletada(): void {
    this.error = null;
    this.pasoActual = this.mostrarEstaciones ? 6 : 7;
  }

  onCargaFacturaDirecta(): void {
    this.error = null;
    this.pasoActual = 7;
  }

  async onCargaExcepcion(paso: PlantillaExcepcionPaso): Promise<void> {
    this.error = null;
    if (paso === 6) {
      this.mostrarEstaciones = true;
      this.pasoActual = 6;
      return;
    }
    if (!this.plantillaApply.tieneMapeosObligatorios()) {
      this.error = 'La plantilla necesita resolver mapeos obligatorios desde el asistente administrativo.';
      return;
    }
    const pendientes = await this.plantillaApply.obtenerPatentesPendientes();
    if (pendientes.length) {
      this.mostrarPatentes = true;
      this.pasoActual = 5;
      return;
    }
    this.error = 'No se encontraron patentes pendientes, pero la plantilla todavía no puede continuar.';
  }

  async onPatentesCompletadas(): Promise<void> {
    this.error = null;
    const siguiente = await this.plantillaApply.resolverSiguienteExcepcion();
    if (siguiente === 6) {
      this.mostrarEstaciones = true;
      this.pasoActual = 6;
      return;
    }
    if (siguiente === null) {
      this.pasoActual = 7;
      return;
    }
    this.error = 'La plantilla todavía necesita mapeos obligatorios.';
  }

  onEstacionesCompletadas(): void {
    this.error = null;
    this.pasoActual = 7;
  }

  onFacturaCompletada(): void {
    this.error = null;
    this.pasoActual = 8;
  }

  onValidacionCompletada(): void {
    this.error = null;
    this.pasoActual = 9;
  }

  onValidacionAtras(): void {
    this.pasoActual = this.mostrarEstaciones ? 6 : this.mostrarPatentes ? 5 : 7;
  }

  onValidacionIrAPaso(paso: 5 | 6 | 7): void {
    if (paso === 6) {
      this.mostrarEstaciones = true;
      this.pasoActual = 6;
      return;
    }
    if (paso === 5) {
      this.mostrarPatentes = true;
      this.pasoActual = 5;
      return;
    }
    if (paso === 7) {
      this.pasoActual = 7;
      return;
    }
    this.error = 'Esta carga Express no permite corregir mapeos o patentes manualmente.';
  }

  onRevisionAtras(): void {
    this.pasoActual = this.mostrarEstaciones ? 6 : this.mostrarPatentes ? 5 : 7;
  }

  reiniciar(): void {
    this.state.reiniciar();
    this.error = null;
    this.mostrarPatentes = false;
    this.mostrarEstaciones = false;
    this.pasoActual = 1;
  }

  mostrarPasoPatentes(): void {
    this.mostrarPatentes = true;
  }

  omitirEstaciones(): void {
    this.mostrarEstaciones = false;
  }

  irA(paso: CargaExpressPasoMeta): void {
    if (paso.numero <= this.pasoVisualActual) {
      this.pasoActual = paso.id;
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.pasoActual !== 1) {
      this.reiniciar();
    }
  }
}
