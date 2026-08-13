import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Inject,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  buscarColumnaPorAliases,
  CONSUMOS_RESUMEN_ALIASES,
  concesionPorValorEstacion,
  Estacion,
  PEAJES_CATALOGO_SERVICE,
  Peaje,
  PeajesCatalogoService,
  RelacionEstacionProveedor,
  reconocerPeajeDesdeConcesion,
  ResultadoReconocimientoEstacion,
} from '../../models';
import { DialogComponent, SearchSelectComponent, SearchSelectOption } from '../../../shared';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';

@Component({
  selector: 'app-paso6-estaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogComponent, SearchSelectComponent],
  templateUrl: './paso6-estaciones.component.html',
  styleUrl: './paso6-estaciones.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Paso6EstacionesComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();

  readonly state = inject(PeajesWizardStateService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly pageSize = 40;

  /** Pool completo (sin filtrar) para poder cambiar peaje de alcance. */
  private todasEstaciones: Estacion[] = [];
  private todosPeajes: Peaje[] = [];
  private estacionById = new Map<string, Estacion>();
  private peajeById = new Map<string, Peaje>();
  /** Options cached by peaje_id; key '' = empresa pool. */
  private estacionOptionsByPeaje = new Map<string, SearchSelectOption[]>();
  private peajeOptionsByEmpresa = new Map<string, SearchSelectOption[]>();

  estaciones: Estacion[] = [];
  peajesUnicos: Peaje[] = [];
  peajeOptions: SearchSelectOption[] = [];
  relaciones: RelacionEstacionProveedor[] = [];
  sugerencias: Record<string, Estacion[]> = {};
  reconocimientos: Record<string, ResultadoReconocimientoEstacion> = {};
  necesitaCrearMap: Record<string, boolean> = {};
  editingValor = new Set<string>();
  nuevasAutorizadas = new Set<string>();
  error: string | null = null;
  successMsg: string | null = null;
  creandoPara: string | null = null;
  nuevaEstacionNombre = '';
  nuevaEstacionUbicacion = '';
  nuevaEstacionPeajeId = '';
  guardandoRelaciones = false;
  usaConcesionPeaje = false;
  columnaConcesion: string | null = null;
  filtro = '';
  rowPage = 0;
  pendientesCount = 0;
  relacionadasCount = 0;

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService
  ) {}

  get peajeUnicoEmpresa(): boolean {
    return this.peajesUnicos.length === 1;
  }

  get peajeNombreUnico(): string {
    return this.peajesUnicos[0]?.nombre ?? '';
  }

  get scopingPorConcesion(): boolean {
    return this.usaConcesionPeaje;
  }

  /** Mostrar selector de peaje aunque no haya columna Concesión (empresa con peajes). */
  get mostrarColumnaPeaje(): boolean {
    return this.scopingPorConcesion || this.peajesUnicos.length > 0;
  }

  get esCargaDensa(): boolean {
    const snap = this.state.snapshot();
    return snap.modoImportacion === 'masiva' || this.relaciones.length > 12;
  }

  get mostrarPeajeRelacionado(): boolean {
    return !this.esCargaDensa && this.relaciones.length > 0 && this.peajesUnicos.length > 0;
  }

  get sinPeajesEmpresa(): boolean {
    return !!this.state.snapshot().empresaId && this.peajesUnicos.length === 0;
  }

  get relacionesFiltradas(): RelacionEstacionProveedor[] {
    const q = this.filtro.trim().toUpperCase();
    if (!q) return this.relaciones;
    return this.relaciones.filter((r) => {
      if (r.valorProveedor.toUpperCase().includes(q)) return true;
      if (r.concesionProveedor?.toUpperCase().includes(q)) return true;
      if (r.estacionId) {
        const est = this.estacionById.get(r.estacionId);
        if (est?.nombre.toUpperCase().includes(q)) return true;
        if (est?.id.toUpperCase().includes(q)) return true;
      }
      return false;
    });
  }

  get totalRowPages(): number {
    return Math.max(1, Math.ceil(this.relacionesFiltradas.length / this.pageSize));
  }

  get relacionesPagina(): RelacionEstacionProveedor[] {
    const start = this.rowPage * this.pageSize;
    return this.relacionesFiltradas.slice(start, start + this.pageSize);
  }

  get pageRangeLabel(): string {
    const total = this.relacionesFiltradas.length;
    if (!total) return '0 estaciones';
    const start = this.rowPage * this.pageSize + 1;
    const end = Math.min(total, (this.rowPage + 1) * this.pageSize);
    return `${start}–${end} de ${total}`;
  }

  trackByValor = (_: number, r: RelacionEstacionProveedor): string => r.valorProveedor;

  estacionOptionsFor(valorProveedor: string): SearchSelectOption[] {
    const peajeId = this.peajeAlcanceDe(valorProveedor) ?? '';
    return this.estacionOptionsByPeaje.get(peajeId) ?? this.estacionOptionsByPeaje.get('') ?? [];
  }

  peajeAlcanceDe(valorProveedor: string): string | null {
    const rel = this.relaciones.find((r) => r.valorProveedor === valorProveedor);
    return rel?.peajeIdAlcance ?? rel?.peajeIdDerivado ?? null;
  }

  peajeOptionsForRow(_valorProveedor: string): SearchSelectOption[] {
    const empresaId = this.state.snapshot().empresaId ?? '';
    if (empresaId && this.peajeOptionsByEmpresa.has(empresaId)) {
      return this.peajeOptionsByEmpresa.get(empresaId)!;
    }
    return this.peajeOptions;
  }

  isEditing(valorProveedor: string): boolean {
    return this.editingValor.has(valorProveedor) || !this.relaciones.find((r) => r.valorProveedor === valorProveedor)?.estacionId;
  }

  estacionNombre(estacionId: string | null): string {
    if (!estacionId) return '—';
    return this.estacionById.get(estacionId)?.nombre ?? estacionId;
  }

  editarFila(valorProveedor: string): void {
    this.editingValor.add(valorProveedor);
    this.cdr.markForCheck();
  }

  onFiltroChange(value: string): void {
    this.filtro = value;
    this.rowPage = 0;
    this.cdr.markForCheck();
  }

  prevRowPage(): void {
    if (this.rowPage <= 0) return;
    this.rowPage -= 1;
    this.cdr.markForCheck();
  }

  nextRowPage(): void {
    if (this.rowPage >= this.totalRowPages - 1) return;
    this.rowPage += 1;
    this.cdr.markForCheck();
  }

  private empresaIdParaValor(valorProveedor: string): string | null {
    const rel = this.relaciones.find((r) => r.valorProveedor === valorProveedor);
    if (rel?.peajeIdAlcance) {
      return this.peajeById.get(rel.peajeIdAlcance)?.empresa_id ?? null;
    }
    const rec = this.state
      .snapshot()
      .recomendacionesPeajeConcesion.find((r) => r.concesion === rel?.concesionProveedor);
    return rec?.empresaId ?? this.state.snapshot().empresaId ?? null;
  }

  onEstacionChange(valorProveedor: string, estacionId: string | null): void {
    void this.seleccionar(valorProveedor, estacionId ?? '');
  }

  onPeajeAlcanceChange(valorProveedor: string, peajeId: string | null): void {
    const id = peajeId ?? '';
    this.relaciones = this.relaciones.map((r) => {
      if (r.valorProveedor !== valorProveedor) return r;
      const estacionOk =
        r.estacionId &&
        this.todasEstaciones.some((e) => e.id === r.estacionId && e.peaje_id === id);
      return {
        ...r,
        peajeIdAlcance: id || null,
        estacionId: estacionOk ? r.estacionId : null,
        peajeIdDerivado: estacionOk ? r.peajeIdDerivado : id || null,
      };
    });
    if (!this.relaciones.find((r) => r.valorProveedor === valorProveedor)?.estacionId) {
      this.editingValor.add(valorProveedor);
    }
    this.refrescarSugerenciasFila(valorProveedor);
    this.refreshNecesitaCrear(valorProveedor);
    this.refreshCounts();
    this.error = null;
    this.cdr.markForCheck();
  }

  onPeajeChange(peajeId: string | null): void {
    this.nuevaEstacionPeajeId = peajeId ?? '';
  }

  async ngOnInit(): Promise<void> {
    await this.recargarCatalogos();
    const valores = this.valoresProveedorUnicos();
    const prev = this.state.snapshot().relacionesEstacion;
    const concesionMap = this.construirMapaConcesion();
    const empresaId = this.state.snapshot().empresaId;
    const peajeUnicoEmpresa =
      this.peajesUnicos.length === 1 ? this.peajesUnicos[0] : null;

    this.relaciones = valores.map((valorProveedor) => {
      const existente = prev.find((r) => r.valorProveedor === valorProveedor);
      const concesion = concesionMap.get(valorProveedor) ?? existente?.concesionProveedor ?? null;
      const peajeRec = concesion
        ? reconocerPeajeDesdeConcesion(
            concesion,
            this.todosPeajes,
            empresaId
          )
        : null;
      const peajeDesdeConcesion =
        peajeRec?.tipo === 'exacta'
          ? peajeRec.peaje
          : peajeRec?.sugerencias.length === 1
            ? peajeRec.sugerencias[0]
            : peajeRec?.sugerencias[0] ?? null;

      // Preferir peaje de la empresa (único o por concesión). Nunca heredar peaje ajeno.
      let peajeAlcance =
        existente?.peajeIdAlcance ??
        peajeDesdeConcesion?.id ??
        this.peajeIdDesdeRecomendacionPaso5(concesion) ??
        peajeUnicoEmpresa?.id ??
        null;

      if (peajeAlcance && empresaId) {
        const peaje = this.peajeById.get(peajeAlcance);
        if (peaje && peaje.empresa_id && peaje.empresa_id !== empresaId && peaje.empresa_id !== '__global__') {
          peajeAlcance = peajeUnicoEmpresa?.id ?? null;
        }
      }

      const pool = peajeAlcance
        ? this.todasEstaciones.filter((e) => e.peaje_id === peajeAlcance)
        : this.estaciones;
      const match =
        existente?.estacionId && pool.some((e) => e.id === existente.estacionId)
          ? existente
          : null;
      const auto = pool.find((e) =>
        (e.codigos_proveedor ?? []).map(String).includes(valorProveedor)
      );

      return {
        valorProveedor,
        estacionId: match?.estacionId ?? auto?.id ?? null,
        peajeIdDerivado: match?.peajeIdDerivado ?? auto?.peaje_id ?? peajeAlcance,
        concesionProveedor: concesion,
        peajeIdAlcance: peajeAlcance,
      };
    });

    await this.reconocerTodas(valores);

    this.nuevaEstacionPeajeId =
      this.relaciones[0]?.peajeIdAlcance ?? this.peajesUnicos[0]?.id ?? '';
    this.refreshCounts();
    this.cdr.markForCheck();
  }

  private peajeIdDesdeRecomendacionPaso5(concesion: string | null): string | null {
    if (!concesion) return null;
    return (
      this.state.snapshot().recomendacionesPeajeConcesion.find((r) => r.concesion === concesion)
        ?.peajeId ?? null
    );
  }

  private construirMapaConcesion(): Map<string, string> {
    const preview = this.state.snapshot().preview;
    const mapeoEstacion = this.state
      .snapshot()
      .mapeos.find((m) => m.columnaDestino === 'ESTACION_ID' && !m.excluida);
    this.columnaConcesion = preview
      ? buscarColumnaPorAliases(preview.columnas, CONSUMOS_RESUMEN_ALIASES.concesion) ?? null
      : null;
    this.usaConcesionPeaje = !!this.columnaConcesion && !!mapeoEstacion && !!preview;
    if (!this.usaConcesionPeaje || !preview || !mapeoEstacion || !this.columnaConcesion) {
      return new Map();
    }
    return concesionPorValorEstacion(
      preview.filasOrigen,
      mapeoEstacion.columnaOrigen,
      this.columnaConcesion,
      (fila) => {
        const v = this.valorEstacionProveedor(fila, mapeoEstacion.columnaOrigen);
        return v == null || v === '' ? null : String(v);
      }
    );
  }

  private async reconocerTodas(valores: string[]): Promise<void> {
    const chunkSize = 20;
    for (let i = 0; i < valores.length; i += chunkSize) {
      const chunk = valores.slice(i, i + chunkSize);
      await Promise.all(chunk.map((v) => this.reconocerFila(v)));
    }
  }

  private async reconocerFila(valorProveedor: string): Promise<void> {
    const peajeId = this.peajeAlcanceDe(valorProveedor);
    // Preferir empresa del wizard (Paso 1); no reconocer contra peajes ajenos.
    const empresaId =
      this.state.snapshot().empresaId ??
      this.peajeById.get(peajeId ?? '')?.empresa_id ??
      undefined;
    const reconocimiento = await firstValueFrom(
      this.catalogo.reconocerEstacion(valorProveedor, empresaId)
    );
    this.reconocimientos[valorProveedor] = reconocimiento;
    this.refrescarSugerenciasFila(valorProveedor, reconocimiento);

    if (reconocimiento.tipo === 'exacta' && reconocimiento.estacion) {
      const enAlcance = this.estacionOptionsFor(valorProveedor).some(
        (o) => o.id === reconocimiento.estacion!.id
      );
      if (enAlcance) {
        await this.seleccionar(valorProveedor, reconocimiento.estacion.id, false);
      }
    }
    this.refreshNecesitaCrear(valorProveedor);
  }

  private refrescarSugerenciasFila(
    valorProveedor: string,
    reconocimiento?: ResultadoReconocimientoEstacion
  ): void {
    const rec = reconocimiento ?? this.reconocimientos[valorProveedor];
    const alcanceIds = new Set(this.estacionOptionsFor(valorProveedor).map((o) => o.id));
    const fromRec = (rec?.sugerencias ?? []).filter((s) => alcanceIds.has(s.id));
    const pool = this.todasEstaciones.filter((e) => alcanceIds.has(e.id));
    const q = valorProveedor.trim().toUpperCase();
    const locales = pool
      .filter(
        (e) =>
          e.nombre.toUpperCase().includes(q) ||
          (e.codigos_proveedor ?? []).some((c) => String(c).toUpperCase().includes(q))
      )
      .slice(0, 6);
    const merged = new Map<string, Estacion>();
    for (const s of [...fromRec, ...locales]) merged.set(s.id, s);
    this.sugerencias[valorProveedor] = [...merged.values()];
  }

  private rebuildOptionCaches(): void {
    this.estacionById = new Map(this.todasEstaciones.map((e) => [e.id, e]));
    this.peajeById = new Map(this.todosPeajes.map((p) => [p.id, p]));
    this.peajeOptions = this.peajesUnicos.map((p) => ({ id: p.id, label: p.nombre }));

    this.estacionOptionsByPeaje.clear();
    this.estacionOptionsByPeaje.set(
      '',
      this.estaciones.map((e) => ({ id: e.id, label: e.nombre }))
    );
    for (const peaje of this.todosPeajes) {
      const opts = this.todasEstaciones
        .filter((e) => e.peaje_id === peaje.id)
        .map((e) => ({ id: e.id, label: e.nombre }));
      this.estacionOptionsByPeaje.set(peaje.id, opts);
    }

    this.peajeOptionsByEmpresa.clear();
    this.peajeOptionsByEmpresa.set('', this.peajeOptions);
    const empresaIds = new Set(
      this.todosPeajes.map((p) => p.empresa_id).filter((id): id is string => !!id)
    );
    for (const empresaId of empresaIds) {
      const pool = this.todosPeajes.filter((p) => !p.empresa_id || p.empresa_id === empresaId);
      this.peajeOptionsByEmpresa.set(
        empresaId,
        (pool.length ? pool : this.todosPeajes).map((p) => ({ id: p.id, label: p.nombre }))
      );
    }
  }

  private async recargarCatalogos(): Promise<void> {
    const empresaId = this.state.snapshot().empresaId ?? undefined;
    this.todosPeajes = await firstValueFrom(this.catalogo.listarPeajes());
    this.todasEstaciones = await firstValueFrom(this.catalogo.listarEstaciones());

    // RN-23 / RN-26: con empresa en Paso 1, NUNCA caer a peajes de otras empresas.
    // (Antes: si la empresa no tenía peajes, se usaba el catálogo completo →
    //  AUTOVIA DEL MERCOSUR auto-matcheaba AUBASA DOCK SUD por codigo 0001.)
    const peajesEmpresa = empresaId
      ? this.todosPeajes.filter(
          (p) => p.empresa_id === empresaId || p.empresa_id === '__global__'
        )
      : this.todosPeajes;
    this.peajesUnicos = peajesEmpresa;
    const peajeIds = new Set(peajesEmpresa.map((p) => p.id));
    this.estaciones = peajeIds.size
      ? this.todasEstaciones.filter((e) => peajeIds.has(e.peaje_id))
      : [];
    this.rebuildOptionCaches();
  }

  private valoresProveedorUnicos(): string[] {
    const s = this.state.snapshot();
    const mapeoEstacion = s.mapeos.find((m) => m.columnaDestino === 'ESTACION_ID' && !m.excluida);
    if (!mapeoEstacion) {
      return [];
    }
    const set = new Set<string>();
    for (const fila of this.state.filasParaReconocimientoEstaciones()) {
      const v = this.valorEstacionProveedor(fila, mapeoEstacion.columnaOrigen);
      if (v !== null && v !== undefined && v !== '') {
        set.add(String(v));
      }
    }
    return [...set];
  }

  private viaIncluidaEnSeleccion(): boolean {
    return this.state.columnasParaMapeo().some((c) => c.toUpperCase() === 'VIA');
  }

  private valorEstacionProveedor(fila: Record<string, unknown>, columnaOrigen: string): unknown {
    const viaOk = this.viaIncluidaEnSeleccion();
    if (
      (columnaOrigen === 'ESTACION' || columnaOrigen === 'Estación') &&
      fila[columnaOrigen] != null &&
      viaOk &&
      (fila['VIA'] != null || fila['Vía'] != null)
    ) {
      return `${fila[columnaOrigen]} - ${fila['VIA'] ?? fila['Vía']}`;
    }
    const estacion = fila[columnaOrigen];
    if (estacion !== undefined) return estacion;

    if (fila['ESTACION'] != null && viaOk && fila['VIA'] != null) {
      return `${fila['ESTACION']} - ${fila['VIA']}`;
    }
    return null;
  }

  peajeDe(estacionId: string | null, valorProveedor?: string): string {
    if (estacionId) {
      const est = this.estacionById.get(estacionId);
      if (est) {
        return (
          est.peaje?.nombre ??
          this.peajeById.get(est.peaje_id)?.nombre ??
          est.peaje_id
        );
      }
    }
    if (valorProveedor) {
      const peajeId = this.peajeAlcanceDe(valorProveedor);
      if (peajeId) {
        return this.peajeById.get(peajeId)?.nombre ?? peajeId;
      }
    }
    return '—';
  }

  get peajePrincipal(): Peaje | null {
    const peajeId =
      this.relaciones.find((r) => r.peajeIdAlcance)?.peajeIdAlcance ??
      this.relaciones.find((r) => r.peajeIdDerivado)?.peajeIdDerivado ??
      this.estaciones[0]?.peaje_id ??
      this.peajesUnicos[0]?.id ??
      null;
    if (!peajeId) {
      return null;
    }
    return (
      this.peajeById.get(peajeId) ??
      this.peajesUnicos.find((p) => p.id === peajeId) ??
      this.todasEstaciones.find((e) => e.peaje_id === peajeId)?.peaje ??
      null
    );
  }

  get ejemploResolucion(): { codigo: string; id: string; nombre: string; peaje: string } | null {
    const conMatch = this.relaciones.find((r) => r.estacionId);
    if (!conMatch?.estacionId) {
      return null;
    }
    const est = this.estacionById.get(conMatch.estacionId);
    if (!est) {
      return null;
    }
    return {
      codigo: conMatch.valorProveedor,
      id: est.id,
      nombre: est.nombre,
      peaje: est.peaje?.nombre ?? this.peajeById.get(est.peaje_id)?.nombre ?? est.peaje_id,
    };
  }

  private refreshNecesitaCrear(valorProveedor: string): void {
    const rec = this.reconocimientos[valorProveedor];
    const rel = this.relaciones.find((r) => r.valorProveedor === valorProveedor);
    this.necesitaCrearMap[valorProveedor] =
      !!rec && rec.tipo === 'sin_coincidencia' && !rel?.estacionId;
  }

  private refreshCounts(): void {
    this.pendientesCount = this.relaciones.filter((r) => !r.estacionId).length;
    this.relacionadasCount = this.relaciones.length - this.pendientesCount;
  }

  necesitaCrear(valorProveedor: string): boolean {
    return !!this.necesitaCrearMap[valorProveedor];
  }

  async seleccionar(valorProveedor: string, estacionId: string, confirmarAlias = true): Promise<void> {
    const est = this.estacionById.get(estacionId) ?? null;
    const prev = this.relaciones.find((r) => r.valorProveedor === valorProveedor);
    this.relaciones = this.relaciones.map((r) =>
      r.valorProveedor === valorProveedor
        ? {
            ...r,
            valorProveedor,
            estacionId: estacionId || null,
            peajeIdDerivado: est?.peaje_id ?? r.peajeIdAlcance ?? null,
            peajeIdAlcance: est?.peaje_id ?? r.peajeIdAlcance ?? null,
            concesionProveedor: r.concesionProveedor,
          }
        : r
    );
    if (estacionId) {
      this.editingValor.delete(valorProveedor);
    } else {
      this.editingValor.add(valorProveedor);
    }
    this.refreshNecesitaCrear(valorProveedor);
    this.refreshCounts();
    this.error = null;
    const empresaId =
      est?.peaje?.empresa_id ??
      this.peajeById.get(est?.peaje_id ?? prev?.peajeIdAlcance ?? '')?.empresa_id ??
      this.state.snapshot().empresaId;
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
    this.cdr.markForCheck();
  }

  abrirCrear(valorProveedor: string): void {
    const reconocimiento = this.reconocimientos[valorProveedor];
    if (reconocimiento?.tipo === 'sugerencias' && !this.nuevasAutorizadas.has(valorProveedor)) {
      this.error = 'Confirmá una sugerencia o indicá que ninguna coincide antes de crear una estación.';
      this.cdr.markForCheck();
      return;
    }
    this.creandoPara = valorProveedor;
    this.nuevaEstacionNombre = String(valorProveedor);
    this.nuevaEstacionUbicacion = '';
    this.nuevaEstacionPeajeId =
      this.peajeAlcanceDe(valorProveedor) ??
      this.peajesUnicos[0]?.id ??
      this.estaciones[0]?.peaje_id ??
      '';
    this.error = null;
    this.successMsg = null;
    this.cdr.markForCheck();
  }

  declararSinCoincidencia(valorProveedor: string): void {
    this.nuevasAutorizadas.add(valorProveedor);
    this.error = null;
    this.abrirCrear(valorProveedor);
  }

  cerrarCrear(): void {
    this.creandoPara = null;
    this.nuevaEstacionUbicacion = '';
    this.cdr.markForCheck();
  }

  async crearEstacion(): Promise<void> {
    if (!this.creandoPara || !this.nuevaEstacionNombre.trim()) {
      return;
    }
    if (!this.nuevaEstacionPeajeId) {
      this.error = 'No hay peajes de la empresa. Creá un peaje en Catálogos antes de continuar.';
      this.cdr.markForCheck();
      return;
    }
    this.error = null;
    try {
      const creada = await firstValueFrom(
        this.catalogo.crearEstacion({
          peaje_id: this.nuevaEstacionPeajeId,
          nombre: this.nuevaEstacionNombre.trim(),
          ubicacion: this.nuevaEstacionUbicacion.trim() || null,
          codigos_proveedor: [this.creandoPara],
        })
      );
      this.todasEstaciones = [...this.todasEstaciones, creada];
      this.estaciones = [...this.estaciones, creada];
      this.rebuildOptionCaches();
      await this.seleccionar(this.creandoPara, creada.id);
      this.creandoPara = null;
      this.successMsg = `Estación «${creada.nombre}» creada y relacionada.`;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo crear la estación.';
    }
    this.cdr.markForCheck();
  }

  async guardarPlantillaRelaciones(): Promise<void> {
    const listas = this.relaciones.filter((r) => r.estacionId);
    if (!listas.length) {
      this.error = 'No hay relaciones para guardar.';
      this.cdr.markForCheck();
      return;
    }
    this.guardandoRelaciones = true;
    this.error = null;
    this.successMsg = null;
    this.cdr.markForCheck();
    try {
      for (const r of listas) {
        const est = this.estacionById.get(r.estacionId!);
        if (!est) continue;
        const codigos = new Set((est.codigos_proveedor ?? []).map(String));
        codigos.add(String(r.valorProveedor));
        const actualizada = await firstValueFrom(
          this.catalogo.actualizarEstacion(est.id, {
            codigos_proveedor: [...codigos],
          })
        );
        this.todasEstaciones = this.todasEstaciones.map((e) =>
          e.id === actualizada.id ? actualizada : e
        );
        this.estaciones = this.estaciones.map((e) =>
          e.id === actualizada.id ? actualizada : e
        );
      }
      this.rebuildOptionCaches();
      this.state.setRelacionesEstacion(this.relaciones);
      this.successMsg =
        'Relaciones guardadas en el catálogo. En la próxima carga se sugerirán automáticamente.';
    } catch (e) {
      this.error =
        e instanceof Error ? e.message : 'No se pudieron guardar las relaciones.';
    } finally {
      this.guardandoRelaciones = false;
      this.cdr.markForCheck();
    }
  }

  sinRelacion(): RelacionEstacionProveedor[] {
    return this.relaciones.filter((r) => !r.estacionId);
  }

  continuar(): void {
    const pendientes = this.sinRelacion();
    if (pendientes.length) {
      this.error = `Hay estaciones sin relacionar: ${pendientes.map((p) => p.valorProveedor).join(', ')}`;
      this.cdr.markForCheck();
      return;
    }
    this.state.setRelacionesEstacion(this.relaciones);
    this.state.setPasadasEstandarizadas(this.state.construirPasadasDesdeMapeo());
    this.completado.emit();
  }
}
