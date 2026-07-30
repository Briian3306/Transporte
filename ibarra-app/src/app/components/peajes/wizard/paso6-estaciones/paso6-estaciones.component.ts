import { Component, EventEmitter, Inject, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  Estacion,
  PEAJES_CATALOGO_SERVICE,
  Peaje,
  PeajesCatalogoService,
  RelacionEstacionProveedor,
} from '../../models';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

@Component({
  selector: 'app-paso6-estaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paso6-estaciones.component.html',
  styleUrl: './paso6-estaciones.component.css',
})
export class Paso6EstacionesComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();

  readonly state = inject(PeajesWizardStateService);

  estaciones: Estacion[] = [];
  peajesUnicos: Peaje[] = [];
  relaciones: RelacionEstacionProveedor[] = [];
  sugerencias: Record<string, Estacion[]> = {};
  error: string | null = null;
  creandoPara: string | null = null;
  nuevaEstacionNombre = '';
  nuevaEstacionPeajeId = '';

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  async ngOnInit(): Promise<void> {
    this.estaciones = await firstValueFrom(this.catalogo.listarEstaciones());
    const peajes = await firstValueFrom(this.catalogo.listarPeajes());
    this.peajesUnicos = peajes;
    const valores = this.valoresProveedorUnicos();
    const prev = this.state.snapshot().relacionesEstacion;

    this.relaciones = valores.map((valorProveedor) => {
      const existente = prev.find((r) => r.valorProveedor === valorProveedor);
      if (existente) {
        return { ...existente };
      }
      const match = this.estaciones.find((e) =>
        (e.codigos_proveedor ?? []).map(String).includes(valorProveedor)
      );
      return {
        valorProveedor,
        estacionId: match?.id ?? null,
        peajeIdDerivado: match?.peaje_id ?? null,
      };
    });

    for (const v of valores) {
      this.sugerencias[v] = await firstValueFrom(this.catalogo.sugerirEstacion(v));
    }

    this.nuevaEstacionPeajeId = this.peajesUnicos[0]?.id ?? '';
  }

  private valoresProveedorUnicos(): string[] {
    const s = this.state.snapshot();
    const mapeoEstacion = s.mapeos.find((m) => m.columnaDestino === 'ESTACION_ID' && !m.excluida);
    if (!mapeoEstacion || !s.preview) {
      return [];
    }
    const set = new Set<string>();
    for (const fila of s.preview.filasPreview) {
      const v = fila[mapeoEstacion.columnaOrigen];
      if (v !== null && v !== undefined && v !== '') {
        set.add(String(v));
      }
    }
    return [...set];
  }

  peajeDe(estacionId: string | null): string {
    if (!estacionId) {
      return '—';
    }
    const est = this.estaciones.find((e) => e.id === estacionId);
    return est?.peaje?.nombre ?? est?.peaje_id ?? '—';
  }

  seleccionar(valorProveedor: string, estacionId: string): void {
    const est = this.estaciones.find((e) => e.id === estacionId) ?? null;
    this.relaciones = this.relaciones.map((r) =>
      r.valorProveedor === valorProveedor
        ? {
            valorProveedor,
            estacionId: estacionId || null,
            peajeIdDerivado: est?.peaje_id ?? null,
          }
        : r
    );
    this.error = null;
  }

  abrirCrear(valorProveedor: string): void {
    this.creandoPara = valorProveedor;
    this.nuevaEstacionNombre = `Estación ${valorProveedor}`;
    this.nuevaEstacionPeajeId = this.estaciones[0]?.peaje_id ?? '';
  }

  async crearEstacion(): Promise<void> {
    if (!this.creandoPara || !this.nuevaEstacionNombre || !this.nuevaEstacionPeajeId) {
      return;
    }
    const creada = await firstValueFrom(
      this.catalogo.crearEstacion({
        peaje_id: this.nuevaEstacionPeajeId,
        nombre: this.nuevaEstacionNombre,
        codigos_proveedor: [this.creandoPara],
      })
    );
    this.estaciones = [...this.estaciones, creada];
    this.seleccionar(this.creandoPara, creada.id);
    this.creandoPara = null;
  }

  sinRelacion(): RelacionEstacionProveedor[] {
    return this.relaciones.filter((r) => !r.estacionId);
  }

  continuar(): void {
    const pendientes = this.sinRelacion();
    if (pendientes.length) {
      this.error = `Hay estaciones sin relacionar: ${pendientes.map((p) => p.valorProveedor).join(', ')}`;
      return;
    }
    this.state.setRelacionesEstacion(this.relaciones);
    this.state.setPasadasEstandarizadas(this.state.construirPasadasDesdeMapeo());
    this.completado.emit();
  }
}
