import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Inject, OnInit, Output, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  PEAJES_CATALOGO_SERVICE,
  Patente,
  PasadaEstandarizada,
  PeajesCatalogoService,
} from '../../models';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';
import {
  normalizarPatenteReferencia,
  resolvePatenteReferences,
} from '../services/patente-reference.helper';

@Component({
  selector: 'app-patentes-express',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './patentes-express.component.html',
  styleUrl: './patentes-express.component.css',
})
export class PatentesExpressComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();

  readonly state = inject(PeajesWizardStateService);
  patentesPendientes: string[] = [];
  accionPatente: string | null = null;
  agregandoTodas = false;
  error: string | null = null;
  catalogoPatentes: Patente[] = [];
  private filasOrigen: PasadaEstandarizada[] = [];

  constructor(@Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService) {}

  get puedeContinuar(): boolean {
    return !this.patentesPendientes.length && !this.accionPatente && !this.agregandoTodas;
  }

  async ngOnInit(): Promise<void> {
    this.filasOrigen = this.filasActuales().map((fila) => ({ ...fila }));
    await this.cargarCatalogo();
    this.recomputarPendientes();
  }

  async agregarPatente(codigo: string): Promise<void> {
    if (this.accionPatente || this.agregandoTodas) return;
    this.accionPatente = codigo;
    this.error = null;
    try {
      const creada = await firstValueFrom(
        this.catalogo.crearPatente({
          patente: codigo.toUpperCase(),
          categoria: 'FLOTA CAMIONES',
          activa: true,
        })
      );
      this.catalogoPatentes = [...this.catalogoPatentes, creada];
      this.reemplazarReferencias();
      this.recomputarPendientes();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo crear la patente.';
    } finally {
      this.accionPatente = null;
    }
  }

  async agregarTodasPatentes(): Promise<void> {
    if (!this.patentesPendientes.length || this.agregandoTodas) return;
    const pendientes = [...this.patentesPendientes];
    this.agregandoTodas = true;
    this.error = null;
    const fallos: string[] = [];
    let agregadas = 0;
    try {
      for (const codigo of pendientes) {
        this.accionPatente = codigo;
        try {
          const creada = await firstValueFrom(
            this.catalogo.crearPatente({
              patente: codigo,
              categoria: 'FLOTA CAMIONES',
              activa: true,
            })
          );
          this.catalogoPatentes = [...this.catalogoPatentes, creada];
          agregadas += 1;
        } catch (e) {
          fallos.push(`${codigo}: ${e instanceof Error ? e.message : 'error'}`);
        }
      }
      this.reemplazarReferencias();
      this.recomputarPendientes();
      if (fallos.length) {
        this.error = `Agregadas ${agregadas}/${pendientes.length}. Fallaron: ${fallos.slice(0, 3).join('; ')}`;
      }
    } finally {
      this.accionPatente = null;
      this.agregandoTodas = false;
    }
  }

  quitarPatente(codigo: string): void {
    this.state.excluirPatenteDelImport(normalizarPatenteReferencia(codigo));
    this.recomputarPendientes();
    this.error = null;
  }

  continuar(): void {
    if (!this.puedeContinuar) {
      this.error = `Resolvé las patentes pendientes (${this.patentesPendientes.length}) antes de continuar.`;
      return;
    }
    this.reemplazarReferencias();
    const excluidas = new Set(this.state.snapshot().patentesExcluidas);
    const resultado = resolvePatenteReferences(this.filasOrigen, this.catalogoPatentes);
    this.state.setPasadasEstandarizadas(
      resultado.rows.filter((_, index) => !excluidas.has(
        normalizarPatenteReferencia(this.filasOrigen[index].PATENTE_ID)
      ))
    );
    this.completado.emit();
  }

  private async cargarCatalogo(): Promise<void> {
    this.catalogoPatentes = (await firstValueFrom(this.catalogo.listarPatentes())).filter(
      (patente) => patente.activa !== false
    );
  }

  private filasActuales() {
    if (this.filasOrigen.length) return this.filasOrigen;
    const actuales = this.state.snapshot().pasadasEstandarizadas;
    return actuales.length ? actuales : this.state.construirPasadasDesdeMapeo();
  }

  private reemplazarReferencias(): void {
    const resultado = resolvePatenteReferences(this.filasActuales(), this.catalogoPatentes);
    this.state.setPasadasEstandarizadas(resultado.rows);
  }

  private recomputarPendientes(): void {
    const resultado = resolvePatenteReferences(this.filasActuales(), this.catalogoPatentes);
    const excluidas = new Set(this.state.snapshot().patentesExcluidas);
    this.patentesPendientes = resultado.unresolved.filter((codigo) => !excluidas.has(codigo));
  }
}
