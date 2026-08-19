import { Component, EventEmitter, Inject, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  buscarColumnaPorAliases,
  coincidirPorNombreNormalizado,
  CONSUMOS_RESUMEN_ALIASES,
  Empresa,
  MapeoColumna,
  PEAJES_CATALOGO_SERVICE,
  PASADA_COLUMNAS_OBLIGATORIAS,
  PASADA_COLUMN_KEYS,
  PasadaColumnKey,
  Peaje,
  PeajesCatalogoService,
  RecomendacionPeajeConcesion,
  reconocerPeajeDesdeConcesion,
} from '../../models';
import { PeajesWizardStateService } from '../services/peajes-wizard-state.service';
import { firstValueFrom } from 'rxjs';
import { DataTableComponent } from '../../../shared/data-table/data-table.component';
import { DataTableColumnDirective } from '../../../shared/data-table/data-table-column.directive';
import { DataTableColumn } from '../../../shared/data-table/data-table.types';
import {
  DialogComponent,
  SearchSelectComponent,
  SearchSelectOption,
} from '../../../shared';

@Component({
  selector: 'app-paso5-mapeo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DataTableComponent,
    DataTableColumnDirective,
    DialogComponent,
    SearchSelectComponent,
  ],
  templateUrl: './paso5-mapeo.component.html',
  styleUrl: './paso5-mapeo.component.css',
})
export class Paso5MapeoComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  @Output() atras = new EventEmitter<void>();

  readonly state = inject(PeajesWizardStateService);
  readonly destinos = PASADA_COLUMN_KEYS;
  readonly obligatorias = PASADA_COLUMNAS_OBLIGATORIAS;

  error: string | null = null;
  seleccionada: string | null = null;
  resolviendoPatentes = false;
  accionPatente: string | null = null;
  /** Bulk Agregar todas en curso (F02-16). */
  agregandoTodas = false;

  /** RN-26: columna Concesion detectada y peajes recomendados. */
  columnaConcesion: string | null = null;
  recomendacionesPeaje: RecomendacionPeajeConcesion[] = [];
  peajesCatalogo: Peaje[] = [];
  empresas: Empresa[] = [];
  filtroConcesionRapido = '';
  accionPeaje: string | null = null;
  agregandoPeajes = false;
  crearPeajeAbierto = false;
  crearPeajeNombre = '';
  crearPeajeConcesion = '';
  crearPeajeEmpresaId: string | null = null;
  crearPeajeDescripcion = '';
  crearEmpresaAbierto = false;
  crearEmpresaNombre = '';
  crearEmpresaConcesion = '';
  crearEmpresaDescripcion = '';
  accionEmpresa: string | null = null;

  /** Mapa normalizado → id de catálogo. */
  private catalogoPatentes = new Map<string, string>();
  /** Patentes del archivo aún no en catálogo ni excluidas. */
  unresolvedPatentes: string[] = [];
  filtroPatenteRapido = '';

  readonly unresolvedColumns: DataTableColumn[] = [
    { key: 'PATENTE', label: 'PATENTE' },
    { key: 'acciones', label: 'Acciones', templateOnly: true, width: '12rem', align: 'right' },
  ];

  readonly peajeUnresolvedColumns: DataTableColumn[] = [
    { key: 'CONCESION', label: 'CONCESIÓN' },
    { key: 'estado', label: 'Estado', templateOnly: true, width: '11rem' },
    { key: 'sugerencias', label: 'Sugerencias', templateOnly: true },
    { key: 'acciones', label: 'Acciones', templateOnly: true, width: '14rem', align: 'right' },
  ];

  constructor(@Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService) {}

  async ngOnInit(): Promise<void> {
    this.state.asegurarMapeosObligatorios();
    await Promise.all([this.cargarCatalogoPatentes(), this.detectarConcesionPeaje()]);
    this.recomputarUnresolved();
  }

  get tieneConcesionPeaje(): boolean {
    return !!this.columnaConcesion && this.recomendacionesPeaje.length > 0;
  }

  get peajesSinResolver(): RecomendacionPeajeConcesion[] {
    return this.recomendacionesPeaje.filter((r) => !r.peajeId);
  }

  get peajesSinResolverVisibles(): RecomendacionPeajeConcesion[] {
    const q = this.filtroConcesionRapido.trim().toUpperCase();
    const list = this.peajesSinResolver;
    return q ? list.filter((r) => r.concesion.toUpperCase().includes(q)) : list;
  }

  get peajeUnresolvedRows(): Record<string, unknown>[] {
    return this.peajesSinResolverVisibles.map((r) => ({
      id: r.concesion,
      CONCESION: r.concesion,
      sugerencias: r.sugerencias ?? [],
      tipo: r.tipo ?? 'sin_coincidencia',
      tieneEmpresa: !!this.empresaParaConcesion(r.concesion),
    }));
  }

  get empresaOptions(): SearchSelectOption[] {
    return this.empresas.map((e) => ({ id: e.id, label: e.nombre }));
  }

  get accionesPeajeOcupadas(): boolean {
    return this.agregandoPeajes || !!this.accionPeaje || !!this.accionEmpresa;
  }

  /** Empresa del catálogo cuyo nombre coincide con la Concesión (si existe). */
  empresaParaConcesion(concesion: string): Empresa | null {
    return coincidirPorNombreNormalizado(concesion, this.empresas);
  }

  necesitaAgregarEmpresa(row: Record<string, unknown>): boolean {
    return row['tipo'] === 'sin_coincidencia' && !row['tieneEmpresa'];
  }

  /** RN-26: Concesion → Peaje con reconocedor tipo estaciones. */
  private async detectarConcesionPeaje(): Promise<void> {
    const preview = this.state.snapshot().preview;
    const cols = preview?.columnas ?? [];
    this.columnaConcesion =
      buscarColumnaPorAliases(cols, CONSUMOS_RESUMEN_ALIASES.concesion) ?? null;
    if (!this.columnaConcesion || !preview) {
      this.recomendacionesPeaje = [];
      this.state.setRecomendacionesPeajeConcesion([]);
      return;
    }

    const empresaId = this.state.snapshot().empresaId;
    this.empresas = await firstValueFrom(this.catalogo.listarEmpresas());
    // Catálogo completo para matching parcial (RN-26 / reconocimiento).
    this.peajesCatalogo = await firstValueFrom(this.catalogo.listarPeajes());

    const valores = new Set<string>();
    for (const fila of preview.filasOrigen) {
      const raw = fila[this.columnaConcesion];
      const v = raw == null ? '' : String(raw).trim();
      if (v) valores.add(v);
    }

    this.recomendacionesPeaje = [...valores].sort().map((concesion) => {
      const rec = reconocerPeajeDesdeConcesion(concesion, this.peajesCatalogo, empresaId);
      const peaje =
        rec.tipo === 'exacta'
          ? rec.peaje
          : rec.sugerencias.length === 1
            ? rec.sugerencias[0]
            : null;
      return {
        concesion,
        peajeId: peaje?.id ?? null,
        peajeNombre: peaje?.nombre ?? null,
        empresaId: peaje?.empresa_id ?? empresaId ?? null,
        tipo: peaje ? 'exacta' : rec.tipo,
        sugerencias: rec.sugerencias.map((s) => ({ id: s.id, nombre: s.nombre })),
      };
    });
    this.persistRecomendacionesPeaje();
  }

  private persistRecomendacionesPeaje(): void {
    this.state.setRecomendacionesPeajeConcesion(this.recomendacionesPeaje);
  }

  confirmarSugerenciaPeaje(concesion: string, peajeId: string, peajeNombre: string): void {
    const peaje = this.peajesCatalogo.find((p) => p.id === peajeId);
    this.recomendacionesPeaje = this.recomendacionesPeaje.map((r) =>
      r.concesion === concesion
        ? {
            ...r,
            peajeId,
            peajeNombre,
            empresaId: peaje?.empresa_id ?? r.empresaId,
            tipo: 'exacta',
            sugerencias: [],
          }
        : r
    );
    this.persistRecomendacionesPeaje();
  }

  abrirCrearPeaje(concesion: string): void {
    this.crearPeajeConcesion = concesion;
    this.crearPeajeNombre = concesion;
    this.crearPeajeDescripcion = `Creado desde Concesión del Excel (${concesion}).`;
    const emp = this.empresaParaConcesion(concesion);
    this.crearPeajeEmpresaId = emp?.id ?? this.state.snapshot().empresaId;
    this.crearPeajeAbierto = true;
    this.error = null;
  }

  abrirCrearEmpresa(concesion: string): void {
    this.crearEmpresaConcesion = concesion;
    this.crearEmpresaNombre = concesion;
    this.crearEmpresaDescripcion = `Creada desde Concesión del Excel (${concesion}).`;
    this.crearEmpresaAbierto = true;
    this.error = null;
  }

  async crearEmpresaDesdeConcesion(): Promise<void> {
    const nombre = this.crearEmpresaNombre.trim();
    if (!nombre) {
      this.error = 'Ingresá el nombre de la empresa.';
      return;
    }
    const existente = coincidirPorNombreNormalizado(nombre, this.empresas);
    if (existente) {
      this.error = `Ya existe la empresa «${existente.nombre}». Usá Agregar peaje.`;
      return;
    }
    this.accionEmpresa = this.crearEmpresaConcesion;
    try {
      const empresa = await firstValueFrom(
        this.catalogo.crearEmpresa({
          nombre,
          descripcion: this.crearEmpresaDescripcion.trim() || null,
        })
      );
      this.empresas = [...this.empresas, empresa];
      // Peaje con el mismo nombre para poder relacionar estaciones en Paso 6.
      const peaje = await firstValueFrom(
        this.catalogo.crearPeaje({
          nombre: this.crearEmpresaConcesion.trim() || nombre,
          empresa_id: empresa.id,
          descripcion: `Peaje/corredor creado desde Concesión «${this.crearEmpresaConcesion}».`,
        })
      );
      this.peajesCatalogo = [...this.peajesCatalogo, peaje];
      this.confirmarSugerenciaPeaje(this.crearEmpresaConcesion, peaje.id, peaje.nombre);
      this.crearEmpresaAbierto = false;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo crear la empresa.';
    } finally {
      this.accionEmpresa = null;
    }
  }

  onEmpresaPeajeChange(id: string | null): void {
    this.crearPeajeEmpresaId = id;
  }

  async crearPeajeDesdeConcesion(): Promise<void> {
    const nombre = this.crearPeajeNombre.trim();
    const empresaId = this.crearPeajeEmpresaId || this.state.snapshot().empresaId;
    if (!nombre || !empresaId) {
      this.error = 'Elegí empresa y nombre del peaje para crearlo.';
      return;
    }
    this.accionPeaje = this.crearPeajeConcesion;
    try {
      const creado = await firstValueFrom(
        this.catalogo.crearPeaje({
          nombre,
          empresa_id: empresaId,
          descripcion: this.crearPeajeDescripcion.trim() || null,
        })
      );
      this.peajesCatalogo = [...this.peajesCatalogo, creado];
      this.confirmarSugerenciaPeaje(this.crearPeajeConcesion, creado.id, creado.nombre);
      this.crearPeajeAbierto = false;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo crear el peaje.';
    } finally {
      this.accionPeaje = null;
    }
  }

  async agregarTodosPeajesPendientes(): Promise<void> {
    const pendientes = this.peajesSinResolverVisibles.filter((r) => r.tipo === 'sin_coincidencia');
    const empresaId = this.state.snapshot().empresaId;
    if (!pendientes.length || !empresaId) {
      this.error = empresaId
        ? 'No hay concesiones sin coincidencia para agregar.'
        : 'Seleccioná una empresa en Paso 1 para crear peajes en lote.';
      return;
    }
    this.agregandoPeajes = true;
    this.error = null;
    let ok = 0;
    const fallos: string[] = [];
    try {
      for (const r of pendientes) {
        this.accionPeaje = r.concesion;
        try {
          const creado = await firstValueFrom(
            this.catalogo.crearPeaje({
              nombre: r.concesion,
              empresa_id: empresaId,
              descripcion: `Creado desde Concesión del Excel.`,
            })
          );
          this.peajesCatalogo = [...this.peajesCatalogo, creado];
          this.confirmarSugerenciaPeaje(r.concesion, creado.id, creado.nombre);
          ok += 1;
        } catch (e) {
          fallos.push(`${r.concesion}: ${e instanceof Error ? e.message : 'error'}`);
        }
      }
      if (fallos.length) {
        this.error = `Agregados ${ok}/${pendientes.length}. Fallaron: ${fallos.slice(0, 2).join('; ')}`;
      }
    } finally {
      this.accionPeaje = null;
      this.agregandoPeajes = false;
    }
  }

  asConcesion(row: Record<string, unknown>): string {
    return String(row['CONCESION'] ?? '');
  }

  sugerenciasDeFila(row: Record<string, unknown>): Array<{ id: string; nombre: string }> {
    const s = row['sugerencias'];
    return Array.isArray(s) ? (s as Array<{ id: string; nombre: string }>) : [];
  }

  get mapeos(): MapeoColumna[] {
    return this.state.mapeosActivos();
  }

  get mapeoSeleccionado(): MapeoColumna | null {
    if (!this.seleccionada) {
      return this.mapeos[0] ?? null;
    }
    return this.mapeos.find((m) => m.columnaOrigen === this.seleccionada) ?? this.mapeos[0] ?? null;
  }

  /** Patentes unresolved respetando el filtro rápido (fuente de bulk actions). */
  patentesVisibles(): string[] {
    const q = this.filtroPatenteRapido.trim().toUpperCase();
    return q
      ? this.unresolvedPatentes.filter((p) => p.includes(q))
      : [...this.unresolvedPatentes];
  }

  get unresolvedRows(): Record<string, unknown>[] {
    return this.patentesVisibles().map((PATENTE) => ({ id: PATENTE, PATENTE }));
  }

  get puedeContinuar(): boolean {
    return (
      !this.faltantes().length &&
      this.unresolvedPatentes.length === 0 &&
      !this.resolviendoPatentes &&
      !this.agregandoTodas
    );
  }

  get accionesPatenteOcupadas(): boolean {
    return this.agregandoTodas || !!this.accionPatente;
  }

  etiquetaOrigen(col: string): string {
    // RN-07: QUANTITY sintético (ASIGNAR_VALOR) — priorizar "valor generado" sobre "(pipeline)".
    if (col === 'QUANTITY' && !this.origenEnArchivo(col)) {
      return 'QUANTITY (valor generado)';
    }
    // Sin columna de descuento: BONIFICACION = 0 (ASIGNAR_VALOR).
    if (col === 'BONIFICACION' && !this.origenEnArchivo(col)) {
      return 'BONIFICACION (valor generado)';
    }
    if (this.esSalidaPipeline(col)) {
      return `${col} (pipeline)`;
    }
    return col;
  }

  esSalidaPipeline(col: string): boolean {
    return this.state.columnasGeneradasPipeline().includes(col);
  }

  /** Origen sintético / no presente como columna del Excel. */
  private origenEnArchivo(col: string): boolean {
    const cols = this.state.snapshot().preview?.columnas ?? this.state.columnasParaMapeo();
    return cols.some((c) => c.trim().toUpperCase() === col.toUpperCase());
  }

  descripcionTransform(m: MapeoColumna): string {
    const dest = m.columnaDestino;
    if (
      m.columnaOrigen === 'BONIFICACION' &&
      !this.origenEnArchivo('BONIFICACION') &&
      dest === 'BONIFICACION'
    ) {
      return 'Asignar 0';
    }
    if (this.esSalidaPipeline(m.columnaOrigen)) {
      return dest
        ? `Salida del pipeline → ${dest}`
        : 'Salida del pipeline (elegí destino estándar)';
    }
    const map: Record<string, string> = {
      FECHA_HORA: 'Completar HORA · combinar columnas',
      PASE_ID: 'Convertir a texto · limpiar',
      PATENTE_ID: 'Eliminar guiones · mayúsculas',
      ESTACION_ID: 'Buscar catálogo interno',
      PRECIO: 'Número decimal',
      BONIFICACION: 'Número decimal',
      QUANTITY: 'Asignar 1',
      IMPORTE_NETO: 'Calcular diferencia',
    };
    if (dest && map[dest]) {
      return map[dest];
    }
    return dest ? 'Mapear columna' : 'Sin transformación';
  }

  setDestino(columnaOrigen: string, destino: string): void {
    const all = this.state.snapshot().mapeos.map((m) => {
      if (m.columnaOrigen !== columnaOrigen) {
        return { ...m };
      }
      return {
        ...m,
        columnaDestino: destino ? (destino as PasadaColumnKey) : null,
      };
    });
    this.state.setMapeos(all);
    this.error = null;
    this.recomputarUnresolved();
  }

  destinoUsado(key: PasadaColumnKey, exceptoOrigen: string): boolean {
    return this.mapeos.some(
      (m) => m.columnaDestino === key && m.columnaOrigen !== exceptoOrigen
    );
  }

  /** Destinos fuera de PASADA_COLUMNAS_OBLIGATORIAS (p. ej. CATEGORIA · F14-3). */
  esDestinoOpcional(key: PasadaColumnKey): boolean {
    return !(this.obligatorias as readonly PasadaColumnKey[]).includes(key);
  }

  faltantes(): PasadaColumnKey[] {
    const mapeados = new Set(
      this.mapeos.filter((m) => m.columnaDestino).map((m) => m.columnaDestino!)
    );
    return this.obligatorias.filter((k) => !mapeados.has(k) && k !== 'IMPORTE_NETO');
  }

  async agregarPatente(patente: string): Promise<void> {
    this.accionPatente = patente;
    this.error = null;
    try {
      await this.crearPatenteEnCatalogo(patente);
      this.recomputarUnresolved();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo crear la patente.';
    } finally {
      this.accionPatente = null;
    }
  }

  quitarPatente(patente: string): void {
    this.state.excluirPatenteDelImport(this.normalizarPatente(patente));
    this.recomputarUnresolved();
    this.error = null;
  }

  /** Alta masiva de las patentes visibles (filtro rápido) — F02-16. */
  async agregarTodasPatentes(): Promise<void> {
    const pendientes = this.patentesVisibles();
    if (!pendientes.length || this.agregandoTodas) {
      return;
    }
    this.agregandoTodas = true;
    this.error = null;
    let ok = 0;
    const fallos: string[] = [];
    try {
      for (const patente of pendientes) {
        this.accionPatente = patente;
        try {
          await this.crearPatenteEnCatalogo(patente);
          ok += 1;
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'error';
          fallos.push(`${patente}: ${msg}`);
        }
      }
      this.recomputarUnresolved();
      if (fallos.length) {
        this.error = `Agregadas ${ok}/${pendientes.length}. Fallaron: ${fallos.slice(0, 3).join('; ')}${
          fallos.length > 3 ? ` (+${fallos.length - 3} más)` : ''
        }`;
      }
    } finally {
      this.accionPatente = null;
      this.agregandoTodas = false;
    }
  }

  /** Excluye del import las patentes visibles (filtro rápido) — F02-16. */
  quitarTodasPatentes(): void {
    if (this.accionesPatenteOcupadas) {
      return;
    }
    for (const patente of this.patentesVisibles()) {
      this.state.excluirPatenteDelImport(this.normalizarPatente(patente));
    }
    this.recomputarUnresolved();
    this.error = null;
  }

  private async crearPatenteEnCatalogo(patente: string): Promise<void> {
    const creada = await firstValueFrom(
      this.catalogo.crearPatente({
        patente: patente.toUpperCase(),
        categoria: 'FLOTA CAMIONES',
        activa: true,
      })
    );
    this.catalogoPatentes.set(this.normalizarPatente(creada.patente), creada.id);
    this.catalogoPatentes.set(creada.id, creada.id);
  }

  asPatente(row: Record<string, unknown>): string {
    return String(row['PATENTE'] ?? '');
  }

  async continuar(): Promise<void> {
    const faltan = this.faltantes();
    if (faltan.length) {
      this.error = `Columnas obligatorias sin mapear: ${faltan.join(', ')}`;
      return;
    }
    this.recomputarUnresolved();
    if (this.unresolvedPatentes.length) {
      this.error = `Resolvé las patentes pendientes (${this.unresolvedPatentes.length}) antes de continuar.`;
      return;
    }
    this.resolviendoPatentes = true;
    try {
      await this.cargarCatalogoPatentes();
      const pasadas = this.state.construirPasadasDesdeMapeo();
      for (const pasada of pasadas) {
        const clave = this.normalizarPatente(pasada.PATENTE_ID);
        const patenteId = this.catalogoPatentes.get(clave);
        if (!patenteId) {
          this.error = `Patente sin resolver tras filtrar exclusiones: ${clave || '(vacía)'}`;
          return;
        }
        pasada.PATENTE_ID = patenteId;
      }
      this.state.setPasadasEstandarizadas(pasadas);
      this.completado.emit();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudo consultar el catálogo de patentes.';
    } finally {
      this.resolviendoPatentes = false;
    }
  }

  private async cargarCatalogoPatentes(): Promise<void> {
    const patentes = await firstValueFrom(this.catalogo.listarPatentes());
    this.catalogoPatentes = new Map<string, string>();
    for (const patente of patentes.filter((p) => p.activa !== false)) {
      this.catalogoPatentes.set(this.normalizarPatente(patente.patente), patente.id);
      this.catalogoPatentes.set(patente.id, patente.id);
    }
  }

  private recomputarUnresolved(): void {
    if (this.faltantes().length) {
      this.unresolvedPatentes = [];
      return;
    }
    const excluidas = new Set(this.state.snapshot().patentesExcluidas);
    const pasadas = this.state.construirPasadasDesdeMapeo();
    const missing = new Set<string>();
    for (const pasada of pasadas) {
      const clave = this.normalizarPatente(pasada.PATENTE_ID);
      if (!clave || excluidas.has(clave)) continue;
      if (!this.catalogoPatentes.has(clave)) {
        missing.add(clave);
      }
    }
    this.unresolvedPatentes = [...missing].sort();
  }

  private normalizarPatente(valor: unknown): string {
    return String(valor ?? '').replace(/[\s-]/g, '').toUpperCase();
  }
}
