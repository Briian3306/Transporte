import { Component, EventEmitter, Inject, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import {
  ErrorValidacionPasada,
  PEAJES_CARGA_SERVICE,
  PeajesCargaService,
  ResultadoValidacionCarga,
} from '../../models';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

@Component({
  selector: 'app-paso8-validacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './paso8-validacion.component.html',
  styleUrl: './paso8-validacion.component.css',
})
export class Paso8ValidacionComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();

  readonly state = inject(PeajesWizardStateService);

  resultado: ResultadoValidacionCarga | null = null;
  duplicados: ErrorValidacionPasada[] = [];
  cargando = false;
  error: string | null = null;

  constructor(@Inject(PEAJES_CARGA_SERVICE) private readonly carga: PeajesCargaService) {}

  async ngOnInit(): Promise<void> {
    await this.validar();
  }

  async validar(): Promise<void> {
    this.cargando = true;
    this.error = null;
    try {
      const s = this.state.snapshot();
      const pasadas =
        s.pasadasEstandarizadas.length > 0
          ? s.pasadasEstandarizadas
          : this.state.construirPasadasDesdeMapeo();
      this.state.setPasadasEstandarizadas(pasadas);

      const factura = this.state.facturaComoPersistible();
      const [validacion, dups] = await Promise.all([
        firstValueFrom(this.carga.validarCarga(pasadas, factura)),
        firstValueFrom(this.carga.detectarDuplicados(pasadas)),
      ]);

      this.duplicados = dups;
      const errores = [...validacion.errores, ...dups];
      this.resultado = { ...validacion, errores };
      this.state.setValidacion(this.resultado);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Error al validar';
    } finally {
      this.cargando = false;
    }
  }

  get puedeContinuar(): boolean {
    if (!this.resultado) {
      return false;
    }
    return this.resultado.errores.length === 0 && this.resultado.dentroTolerancia;
  }

  get sumaNetos(): number {
    const pasadas = this.state.snapshot().pasadasEstandarizadas;
    return pasadas.reduce((acc, p) => acc + Number(p.IMPORTE_NETO ?? 0), 0);
  }

  continuar(): void {
    if (!this.puedeContinuar) {
      return;
    }
    this.completado.emit();
  }
}
