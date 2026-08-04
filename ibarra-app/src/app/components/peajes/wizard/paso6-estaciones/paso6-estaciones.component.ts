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
  ResultadoReconocimientoEstacion,
} from '../../models';
import { DialogComponent } from '../../../shared';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

@Component({
  selector: 'app-paso6-estaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogComponent],
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
  reconocimientos: Record<string, ResultadoReconocimientoEstacion> = {};
  nuevasAutorizadas = new Set<string>();
  error: string | null = null;
  successMsg: string | null = null;
  creandoPara: string | null = null;
  nuevaEstacionNombre = '';
  nuevaEstacionPeajeId = '';
  guardandoRelaciones = false;

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  get peajeUnicoEmpresa(): boolean {
    return this.peajesUnicos.length === 1;
  }

  get peajeNombreUnico(): string {
    return this.peajesUnicos[0]?.nombre ?? '';
  }

  async ngOnInit(): Promise<void> {
    await this.recargarCatalogos();
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
      const reconocimiento = await firstValueFrom(
        this.catalogo.reconocerEstacion(v, this.state.snapshot().empresaId ?? undefined)
      );
      this.reconocimientos[v] = reconocimiento;
      this.sugerencias[v] = reconocimiento.sugerencias.filter((s) =>
        this.estaciones.some((e) => e.id === s.id)
      );
      if (reconocimiento.tipo === 'exacta' && reconocimiento.estacion) {
        const enScope = this.estaciones.some((e) => e.id === reconocimiento.estacion!.id);
        if (enScope) {
          this.seleccionar(v, reconocimiento.estacion.id, false);
        }
      }
    }

    this.nuevaEstacionPeajeId = this.peajesUnicos[0]?.id ?? '';
  }

  private async recargarCatalogos(): Promise<void> {
    const empresaId = this.state.snapshot().empresaId ?? undefined;
    let peajes = await firstValueFrom(this.catalogo.listarPeajes(empresaId));
    if (!peajes.length && empresaId) {
      peajes = await firstValueFrom(this.catalogo.listarPeajes());
    }
    this.peajesUnicos = peajes;
    const peajeIds = new Set(peajes.map((p) => p.id));

    const todas = await firstValueFrom(this.catalogo.listarEstaciones());
    this.estaciones = peajeIds.size
      ? todas.filter((e) => peajeIds.has(e.peaje_id))
      : todas;
  }

  private valoresProveedorUnicos(): string[] {
    const s = this.state.snapshot();
    const mapeoEstacion = s.mapeos.find((m) => m.columnaDestino === 'ESTACION_ID' && !m.excluida);
    if (!mapeoEstacion || !s.preview) {
      return [];
    }
    const set = new Set<string>();
    for (const fila of s.preview.filasOrigen) {
      const v = this.valorEstacionProveedor(fila, mapeoEstacion.columnaOrigen);
      if (v !== null && v !== undefined && v !== '') {
        set.add(String(v));
      }
    }
    return [...set];
  }

  /** VIA solo entra al código proveedor si quedó incluida en Paso 2 (F02-15). */
  private viaIncluidaEnSeleccion(): boolean {
    return this.state.columnasParaMapeo().some((c) => c.toUpperCase() === 'VIA');
  }

  private valorEstacionProveedor(fila: Record<string, unknown>, columnaOrigen: string): unknown {
    const viaOk = this.viaIncluidaEnSeleccion();
    if (
      columnaOrigen === 'ESTACION' &&
      fila['ESTACION'] != null &&
      viaOk &&
      fila['VIA'] != null
    ) {
      return `${fila['ESTACION']} - ${fila['VIA']}`;
    }
    const estacion = fila[columnaOrigen];
    if (estacion !== undefined) return estacion;

    if (fila['ESTACION'] != null && viaOk && fila['VIA'] != null) {
      return `${fila['ESTACION']} - ${fila['VIA']}`;
    }
    return null;
  }

  peajeDe(estacionId: string | null): string {
    if (!estacionId) {
      return '—';
    }
    const est = this.estaciones.find((e) => e.id === estacionId);
    return est?.peaje?.nombre ?? est?.peaje_id ?? '—';
  }

  get peajePrincipal(): Peaje | null {
    const peajeId =
      this.relaciones.find((r) => r.peajeIdDerivado)?.peajeIdDerivado ??
      this.estaciones[0]?.peaje_id ??
      this.peajesUnicos[0]?.id ??
      null;
    if (!peajeId) {
      return null;
    }
    return (
      this.peajesUnicos.find((p) => p.id === peajeId) ??
      this.estaciones.find((e) => e.peaje_id === peajeId)?.peaje ??
      null
    );
  }

  get ejemploResolucion(): { codigo: string; id: string; nombre: string; peaje: string } | null {
    const conMatch = this.relaciones.find((r) => r.estacionId);
    if (!conMatch?.estacionId) {
      return null;
    }
    const est = this.estaciones.find((e) => e.id === conMatch.estacionId);
    if (!est) {
      return null;
    }
    return {
      codigo: conMatch.valorProveedor,
      id: est.id,
      nombre: est.nombre,
      peaje: est.peaje?.nombre ?? est.peaje_id,
    };
  }

  necesitaCrear(valorProveedor: string): boolean {
    const rec = this.reconocimientos[valorProveedor];
    const rel = this.relaciones.find((r) => r.valorProveedor === valorProveedor);
    return !!rec && rec.tipo === 'sin_coincidencia' && !rel?.estacionId;
  }

  async seleccionar(valorProveedor: string, estacionId: string, confirmarAlias = true): Promise<void> {
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
    const empresaId = this.state.snapshot().empresaId;
    if (confirmarAlias && estacionId && empresaId) {
      try {
        await firstValueFrom(
          this.catalogo.confirmarAliasEstacion({
            empresa_id: empresaId,
            estacion_id: estacionId,
            valor_proveedor: valorProveedor,
            origen: 'usuario',
          })
        );
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo guardar la equivalencia de estación.';
      }
    }
  }

  abrirCrear(valorProveedor: string): void {
    const reconocimiento = this.reconocimientos[valorProveedor];
    if (reconocimiento?.tipo === 'sugerencias' && !this.nuevasAutorizadas.has(valorProveedor)) {
      this.error = 'Confirmá una sugerencia o indicá que ninguna coincide antes de crear una estación.';
      return;
    }
    this.creandoPara = valorProveedor;
    this.nuevaEstacionNombre = String(valorProveedor);
    this.nuevaEstacionPeajeId = this.peajesUnicos[0]?.id ?? this.estaciones[0]?.peaje_id ?? '';
    this.error = null;
    this.successMsg = null;
  }

  declararSinCoincidencia(valorProveedor: string): void {
    this.nuevasAutorizadas.add(valorProveedor);
    this.error = null;
    this.abrirCrear(valorProveedor);
  }

  cerrarCrear(): void {
    this.creandoPara = null;
  }

  async crearEstacion(): Promise<void> {
    if (!this.creandoPara || !this.nuevaEstacionNombre.trim()) {
      return;
    }
    if (!this.nuevaEstacionPeajeId) {
      this.error = 'No hay peajes de la empresa. Creá un peaje en Catálogos antes de continuar.';
      return;
    }
    this.error = null;
    try {
      const creada = await firstValueFrom(
        this.catalogo.crearEstacion({
          peaje_id: this.nuevaEstacionPeajeId,
          nombre: this.nuevaEstacionNombre.trim(),
          codigos_proveedor: [this.creandoPara],
        })
      );
      this.estaciones = [...this.estaciones, creada];
      await this.seleccionar(this.creandoPara, creada.id);
      this.creandoPara = null;
      this.successMsg = `Estación «${creada.nombre}» creada y relacionada.`;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo crear la estación.';
    }
  }

  async guardarPlantillaRelaciones(): Promise<void> {
    const listas = this.relaciones.filter((r) => r.estacionId);
    if (!listas.length) {
      this.error = 'No hay relaciones para guardar.';
      return;
    }
    this.guardandoRelaciones = true;
    this.error = null;
    this.successMsg = null;
    try {
      for (const r of listas) {
        const est = this.estaciones.find((e) => e.id === r.estacionId);
        if (!est) continue;
        const codigos = new Set((est.codigos_proveedor ?? []).map(String));
        codigos.add(String(r.valorProveedor));
        const actualizada = await firstValueFrom(
          this.catalogo.actualizarEstacion(est.id, {
            codigos_proveedor: [...codigos],
          })
        );
        this.estaciones = this.estaciones.map((e) =>
          e.id === actualizada.id ? actualizada : e
        );
      }
      this.state.setRelacionesEstacion(this.relaciones);
      this.successMsg =
        'Relaciones guardadas en el catálogo. En la próxima carga se sugerirán automáticamente.';
    } catch (e) {
      this.error =
        e instanceof Error ? e.message : 'No se pudieron guardar las relaciones.';
    } finally {
      this.guardandoRelaciones = false;
    }
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
