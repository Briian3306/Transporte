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
  reconocimientos: Record<string, ResultadoReconocimientoEstacion> = {};
  nuevasAutorizadas = new Set<string>();
  error: string | null = null;
  successMsg: string | null = null;
  creandoPara: string | null = null;
  nuevaEstacionNombre = '';
  nuevaEstacionPeajeId = '';

  /** Inline create peaje */
  crearPeajeAbierto = false;
  nuevoPeajeNombre = '';
  nuevoPeajeUbicacion = '';
  creandoPeaje = false;
  guardandoRelaciones = false;

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

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
      this.sugerencias[v] = reconocimiento.sugerencias;
      if (reconocimiento.tipo === 'exacta' && reconocimiento.estacion) {
        this.seleccionar(v, reconocimiento.estacion.id, false);
      }
    }

    this.nuevaEstacionPeajeId = this.peajesUnicos[0]?.id ?? '';
  }

  private async recargarCatalogos(): Promise<void> {
    const empresaId = this.state.snapshot().empresaId ?? undefined;
    this.estaciones = await firstValueFrom(this.catalogo.listarEstaciones());
    // Sin filtrar por empresa si la lista queda vacía (peajes globales / sin empresa_id)
    let peajes = await firstValueFrom(this.catalogo.listarPeajes(empresaId));
    if (!peajes.length && empresaId) {
      peajes = await firstValueFrom(this.catalogo.listarPeajes());
    }
    this.peajesUnicos = peajes;
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

  private valorEstacionProveedor(fila: Record<string, unknown>, columnaOrigen: string): unknown {
    if (columnaOrigen === 'ESTACION' && fila['ESTACION'] != null && fila['VIA'] != null) {
      return `${fila['ESTACION']} - ${fila['VIA']}`;
    }
    const estacion = fila[columnaOrigen];
    if (estacion !== undefined) return estacion;

    // Acceso Oeste identifica la estación del proveedor por zona y vía.
    if (fila['ESTACION'] != null && fila['VIA'] != null) {
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
    return this.peajesUnicos.find((p) => p.id === peajeId) ?? this.estaciones.find((e) => e.peaje_id === peajeId)?.peaje ?? null;
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
        await firstValueFrom(this.catalogo.confirmarAliasEstacion({
          empresa_id: empresaId,
          estacion_id: estacionId,
          valor_proveedor: valorProveedor,
          origen: 'usuario',
        }));
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
    this.nuevaEstacionNombre = `Estación ${valorProveedor}`;
    this.nuevaEstacionPeajeId =
      this.peajesUnicos[0]?.id ?? this.estaciones[0]?.peaje_id ?? '';
    this.crearPeajeAbierto = !this.peajesUnicos.length;
    this.error = null;
    this.successMsg = null;
  }

  declararSinCoincidencia(valorProveedor: string): void {
    this.nuevasAutorizadas.add(valorProveedor);
    this.error = null;
    this.abrirCrear(valorProveedor);
  }

  abrirCrearPeaje(): void {
    this.crearPeajeAbierto = true;
    this.nuevoPeajeNombre = '';
    this.nuevoPeajeUbicacion = '';
    this.error = null;
  }

  async crearPeaje(): Promise<void> {
    const nombre = this.nuevoPeajeNombre.trim();
    if (!nombre) {
      this.error = 'Ingresá el nombre del peaje.';
      return;
    }
    this.creandoPeaje = true;
    this.error = null;
    try {
      const empresaId = this.state.snapshot().empresaId;
      const creado = await firstValueFrom(
        this.catalogo.crearPeaje({
          nombre,
          ubicacion: this.nuevoPeajeUbicacion.trim() || null,
          descripcion: null,
          empresa_id: empresaId,
        })
      );
      this.peajesUnicos = [...this.peajesUnicos, creado];
      this.nuevaEstacionPeajeId = creado.id;
      this.crearPeajeAbierto = false;
      this.successMsg = `Peaje «${creado.nombre}» creado. Ahora podés crear la estación.`;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo crear el peaje.';
    } finally {
      this.creandoPeaje = false;
    }
  }

  async crearEstacion(): Promise<void> {
    if (!this.creandoPara || !this.nuevaEstacionNombre.trim()) {
      return;
    }
    if (!this.nuevaEstacionPeajeId) {
      this.error = 'Seleccioná o creá un peaje antes de relacionar la estación.';
      this.crearPeajeAbierto = true;
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
      this.successMsg = `Estación «${creada.nombre}» creada y relacionada (código ${creada.codigos_proveedor?.[0] ?? ''}). Quedará disponible la próxima vez.`;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo crear la estación.';
    }
  }

  /**
   * Persiste códigos de proveedor en las estaciones ya relacionadas
   * para reutilizar el match en cargas futuras (plantilla de relaciones).
   */
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
