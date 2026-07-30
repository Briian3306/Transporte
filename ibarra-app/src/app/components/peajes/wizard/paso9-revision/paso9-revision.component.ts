import { Component, EventEmitter, Inject, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import {
  ConfirmacionCargaResultado,
  PEAJES_CARGA_SERVICE,
  PeajesCargaService,
} from '../../models';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

@Component({
  selector: 'app-paso9-revision',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './paso9-revision.component.html',
  styleUrl: './paso9-revision.component.css',
})
export class Paso9RevisionComponent {
  @Output() atras = new EventEmitter<void>();
  @Output() reiniciar = new EventEmitter<void>();

  readonly state = inject(PeajesWizardStateService);

  guardando = false;
  error: string | null = null;
  resultado: ConfirmacionCargaResultado | null = null;

  constructor(@Inject(PEAJES_CARGA_SERVICE) private readonly carga: PeajesCargaService) {}

  get snap() {
    return this.state.snapshot();
  }

  async confirmar(): Promise<void> {
    this.guardando = true;
    this.error = null;
    try {
      const s = this.state.snapshot();
      const pasadas = s.validacion?.validas?.length
        ? s.validacion.validas
        : s.pasadasEstandarizadas;

      const res = await firstValueFrom(
        this.carga.confirmarCarga({
          factura: this.state.facturaComoPersistible(),
          pasadas,
          plantillaId: s.plantillaId,
          mapeos: s.mapeos,
          relacionesEstacion: s.relacionesEstacion,
          parametrosEfectivos: {
            archivo: s.preview?.nombreArchivo,
            totalFilas: s.preview?.totalFilas,
          },
        })
      );
      this.resultado = res;
      this.state.setConfirmacion(res);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo confirmar la carga';
    } finally {
      this.guardando = false;
    }
  }
}
