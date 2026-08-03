import { Injectable } from '@angular/core';
import {
  ConfiguracionPlantilla,
  ConfirmacionCargaResultado,
  ExcelCargaPreview,
  Factura,
  MapeoColumna,
  PASADA_COLUMN_KEYS,
  PasadaColumnKey,
  PasadaEstandarizada,
  RelacionEstacionProveedor,
  ResultadoValidacionCarga,
} from '../../models';
import {
  MVP_COLUMNAS_EXCLUIDAS,
  MVP_COLUMNAS_INCLUIDAS,
  MVP_FACTURA,
  buildMvpMapeos,
  buildMvpPreview,
  combinarFechaHoraMvp,
  normalizarPaseMvp,
  normalizarPatenteMvp,
} from '../fixtures/mvp-ejemplo.fixture';
import {
  ColumnRecommendation,
  buildDemoPipelineSeeds,
  detectColumnRecommendations,
  tieneHeadersParaSeedDemo,
} from './column-recognition';
import { ConfiguracionPlantillaDraft } from './wizard-draft.types';

export type { ConfiguracionPlantillaDraft } from './wizard-draft.types';
export type { ColumnRecommendation } from './column-recognition';

export type WizardPasoId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface WizardFacturaForm {
  factura: string;
  cuenta: string;
  empresa_id: string;
  fecha_factura: string;
  importe_sin_iva: number | null;
  importe_total: number | null;
}

export interface PlantillaWizardMeta {
  id: string | null;
  nombre: string;
  descripcion?: string | null;
  empresa_id: string;
  estado: string;
  tipo_archivo?: string | null;
}

export interface PeajesWizardState {
  pasoActual: WizardPasoId;
  preview: ExcelCargaPreview | null;
  columnasIncluidas: string[];
  columnasExcluidas: string[];
  mapeos: MapeoColumna[];
  relacionesEstacion: RelacionEstacionProveedor[];
  factura: WizardFacturaForm;
  pasadasEstandarizadas: PasadaEstandarizada[];
  validacion: ResultadoValidacionCarga | null;
  confirmacion: ConfirmacionCargaResultado | null;
  plantillaId: string | null;
  empresaId: string | null;
  /** Pipeline editable (Paso 3) — draft local. */
  configuracionesDraft: ConfiguracionPlantillaDraft[];
  plantillaMeta: PlantillaWizardMeta | null;
  /** JSON snapshot de configuracionesDraft al último markPipelineSaved; null = nunca guardado. */
  pipelineSnapshotSaved: string | null;
  /** Recomendaciones semánticas de columnas (F02-11). */
  recomendaciones: ColumnRecommendation[];
}

const FACTURA_VACIA: WizardFacturaForm = {
  factura: '',
  cuenta: '',
  empresa_id: '',
  fecha_factura: '',
  importe_sin_iva: null,
  importe_total: null,
};

function estadoInicial(): PeajesWizardState {
  return {
    pasoActual: 1,
    preview: null,
    columnasIncluidas: [],
    columnasExcluidas: [],
    mapeos: [],
    relacionesEstacion: [],
    factura: { ...FACTURA_VACIA },
    pasadasEstandarizadas: [],
    validacion: null,
    confirmacion: null,
    plantillaId: null,
    empresaId: null,
    configuracionesDraft: [],
    plantillaMeta: null,
    pipelineSnapshotSaved: null,
    recomendaciones: [],
  };
}

function nuevoClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneDraft(step: ConfiguracionPlantillaDraft): ConfiguracionPlantillaDraft {
  return structuredClone(step);
}

function renumerarOrden(drafts: ConfiguracionPlantillaDraft[]): ConfiguracionPlantillaDraft[] {
  return drafts.map((d, i) => ({ ...d, orden: (i + 1) * 10 }));
}

function serializeDraft(drafts: ConfiguracionPlantillaDraft[]): string {
  return JSON.stringify(drafts);
}

/**
 * Estado compartido del wizard (RF-25 / F02-9 / F02-10 draft).
 * Conserva configuración al volver a pasos anteriores.
 */
@Injectable({ providedIn: 'root' })
export class PeajesWizardStateService {
  private state: PeajesWizardState = estadoInicial();

  snapshot(): PeajesWizardState {
    return structuredClone(this.state);
  }

  get pasoActual(): WizardPasoId {
    return this.state.pasoActual;
  }

  setPaso(paso: WizardPasoId): void {
    this.state.pasoActual = paso;
  }

  setPreview(preview: ExcelCargaPreview): void {
    this.state.preview = preview;
    this.state.columnasIncluidas = [...preview.columnas];
    this.state.columnasExcluidas = [];
    this.state.mapeos = preview.columnas.map((columnaOrigen) => ({
      columnaOrigen,
      columnaDestino: null,
      excluida: false,
    }));
    this.state.relacionesEstacion = [];
    this.state.pasadasEstandarizadas = [];
    this.state.validacion = null;
    this.state.confirmacion = null;
    this.state.configuracionesDraft = [];
    this.state.pipelineSnapshotSaved = null;
    this.state.recomendaciones = detectColumnRecommendations(preview);
    this.aplicarSugerenciasSiPareceMvp(preview);
  }

  /**
   * Carga el fixture del ejemplo MVP (10 filas + selección/mapeo/factura sugeridos).
   * Equivale a recorrer el caso de `ejemplo-mvp-procesamiento-pasadas.md`.
   */
  cargarEjemploMvp(): void {
    this.setPreview(buildMvpPreview());
    this.setSeleccionColumnas([...MVP_COLUMNAS_INCLUIDAS], [...MVP_COLUMNAS_EXCLUIDAS]);
    this.setMapeos(buildMvpMapeos());
    this.setFactura({ ...MVP_FACTURA });
    this.state.plantillaId = null;
  }

  /** Si el Excel trae las columnas del ejemplo, preselecciona incluidas/excluidas y mapeo. */
  private aplicarSugerenciasSiPareceMvp(preview: ExcelCargaPreview): void {
    const colsUpper = new Set(preview.columnas.map((c) => c.toUpperCase()));
    const requeridas = ['FECHA', 'HORA', 'ESTACION', 'DISPOSITIVON', 'DOMINIO', 'TARIFA', 'BONIFICACION'];
    if (!requeridas.every((c) => colsUpper.has(c))) {
      return;
    }

    const findCol = (name: string): string | undefined =>
      preview.columnas.find((c) => c.toUpperCase() === name);

    const incluidasNorm = (MVP_COLUMNAS_INCLUIDAS as readonly string[])
      .map(findCol)
      .filter((c): c is string => !!c);
    const excluidasNorm = (MVP_COLUMNAS_EXCLUIDAS as readonly string[])
      .map(findCol)
      .filter((c): c is string => !!c);

    if (incluidasNorm.length < 7) {
      return;
    }

    this.setSeleccionColumnas(incluidasNorm, excluidasNorm);
    const mapeos = buildMvpMapeos().map((m) => {
      const origenReal = findCol(m.columnaOrigen) ?? m.columnaOrigen;
      return { ...m, columnaOrigen: origenReal };
    });
    this.setMapeos(mapeos);
  }

  setSeleccionColumnas(incluidas: string[], excluidas: string[]): void {
    this.state.columnasIncluidas = [...incluidas];
    this.state.columnasExcluidas = [...excluidas];
    this.state.mapeos = this.state.mapeos
      .filter((m) => incluidas.includes(m.columnaOrigen) || excluidas.includes(m.columnaOrigen))
      .map((m) => ({
        ...m,
        excluida: excluidas.includes(m.columnaOrigen),
        columnaDestino: excluidas.includes(m.columnaOrigen) ? null : m.columnaDestino,
      }));

    for (const col of incluidas) {
      if (!this.state.mapeos.some((m) => m.columnaOrigen === col)) {
        this.state.mapeos.push({ columnaOrigen: col, columnaDestino: null, excluida: false });
      }
    }
  }

  setMapeos(mapeos: MapeoColumna[]): void {
    this.state.mapeos = mapeos.map((m) => ({ ...m }));
  }

  setRelacionesEstacion(relaciones: RelacionEstacionProveedor[]): void {
    this.state.relacionesEstacion = relaciones.map((r) => ({ ...r }));
  }

  setFactura(factura: WizardFacturaForm): void {
    this.state.factura = { ...factura };
  }

  setPasadasEstandarizadas(pasadas: PasadaEstandarizada[]): void {
    this.state.pasadasEstandarizadas = pasadas.map((p) => ({ ...p }));
  }

  setValidacion(validacion: ResultadoValidacionCarga | null): void {
    this.state.validacion = validacion ? structuredClone(validacion) : null;
  }

  setConfirmacion(confirmacion: ConfirmacionCargaResultado | null): void {
    this.state.confirmacion = confirmacion ? structuredClone(confirmacion) : null;
  }

  setPlantillaId(id: string | null): void {
    this.state.plantillaId = id;
  }

  setEmpresaId(id: string | null): void {
    this.state.empresaId = id;
  }

  // ── Draft pipeline (F02-10 Wave 1) ───────────────────────────────────────

  setConfiguracionesDraft(drafts: ConfiguracionPlantillaDraft[]): void {
    this.state.configuracionesDraft = renumerarOrden(drafts.map(cloneDraft));
  }

  getConfiguracionesDraft(): ConfiguracionPlantillaDraft[] {
    return this.state.configuracionesDraft.map(cloneDraft);
  }

  updateDraftStep(clientId: string, patch: Partial<ConfiguracionPlantillaDraft>): void {
    const idx = this.state.configuracionesDraft.findIndex((d) => d.clientId === clientId);
    if (idx < 0) {
      return;
    }
    const current = this.state.configuracionesDraft[idx];
    const { clientId: _ignore, ...rest } = patch;
    this.state.configuracionesDraft[idx] = {
      ...current,
      ...rest,
      clientId: current.clientId,
      configuracion:
        patch.configuracion === undefined
          ? current.configuracion
          : patch.configuracion === null
            ? null
            : { ...(current.configuracion ?? {}), ...patch.configuracion },
    };
  }

  addDraftStep(
    step: Omit<ConfiguracionPlantillaDraft, 'clientId' | 'orden'> &
      Partial<Pick<ConfiguracionPlantillaDraft, 'clientId' | 'orden'>>
  ): ConfiguracionPlantillaDraft {
    const nextOrden =
      this.state.configuracionesDraft.length === 0
        ? 10
        : Math.max(...this.state.configuracionesDraft.map((d) => d.orden)) + 10;
    const created: ConfiguracionPlantillaDraft = {
      clientId: step.clientId ?? nuevoClientId(),
      orden: step.orden ?? nextOrden,
      tipo: step.tipo,
      nombre_columna: step.nombre_columna,
      columna_destino: step.columna_destino ?? null,
      algoritmo_combinado_id: step.algoritmo_combinado_id ?? null,
      configuracion: step.configuracion ? structuredClone(step.configuracion) : null,
      obligatoria: step.obligatoria,
    };
    this.state.configuracionesDraft = renumerarOrden([
      ...this.state.configuracionesDraft,
      created,
    ]);
    return cloneDraft(
      this.state.configuracionesDraft.find((d) => d.clientId === created.clientId)!
    );
  }

  removeDraftStep(clientId: string): void {
    this.state.configuracionesDraft = renumerarOrden(
      this.state.configuracionesDraft.filter((d) => d.clientId !== clientId)
    );
  }

  duplicateDraftStep(clientId: string): ConfiguracionPlantillaDraft | null {
    const idx = this.state.configuracionesDraft.findIndex((d) => d.clientId === clientId);
    if (idx < 0) {
      return null;
    }
    const copy = cloneDraft(this.state.configuracionesDraft[idx]);
    copy.clientId = nuevoClientId();
    const next = [...this.state.configuracionesDraft];
    next.splice(idx + 1, 0, copy);
    this.state.configuracionesDraft = renumerarOrden(next);
    return cloneDraft(this.state.configuracionesDraft[idx + 1]);
  }

  /** Reordena por índice (0-based) y reasigna `orden` ascendente (10, 20, …). */
  reorderDraftSteps(from: number, to: number): void {
    const list = [...this.state.configuracionesDraft];
    if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) {
      return;
    }
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    this.state.configuracionesDraft = renumerarOrden(list);
  }

  setStepHabilitado(clientId: string, habilitado: boolean): void {
    const step = this.state.configuracionesDraft.find((d) => d.clientId === clientId);
    if (!step) {
      return;
    }
    step.configuracion = { ...(step.configuracion ?? {}), habilitado };
  }

  setPlantillaMeta(meta: PlantillaWizardMeta | null): void {
    this.state.plantillaMeta = meta ? structuredClone(meta) : null;
    if (meta?.id !== undefined) {
      this.state.plantillaId = meta.id;
    }
  }

  markPipelineSaved(): void {
    this.state.pipelineSnapshotSaved = serializeDraft(this.state.configuracionesDraft);
  }

  isPipelineDirty(): boolean {
    const current = serializeDraft(this.state.configuracionesDraft);
    if (this.state.pipelineSnapshotSaved === null) {
      return this.state.configuracionesDraft.length > 0;
    }
    return current !== this.state.pipelineSnapshotSaved;
  }

  discardPipelineChanges(): void {
    if (this.state.pipelineSnapshotSaved === null) {
      this.state.configuracionesDraft = [];
      return;
    }
    this.state.configuracionesDraft = JSON.parse(
      this.state.pipelineSnapshotSaved
    ) as ConfiguracionPlantillaDraft[];
  }

  /**
   * Si el draft está vacío y el preview tiene headers semánticos suficientes
   * (FECHA/HORA + patente + dispositivo + tarifa + bonificación), siembra pasos
   * atómicos vía las mismas recetas que F02-11.
   */
  seedDemoPipelineIfEmpty(): boolean {
    if (this.state.configuracionesDraft.length > 0) {
      return false;
    }
    const preview = this.state.preview;
    if (!preview || !tieneHeadersParaSeedDemo(preview.columnas)) {
      return false;
    }

    const seeds = buildDemoPipelineSeeds(preview);
    if (seeds.length === 0) {
      return false;
    }

    this.state.configuracionesDraft = renumerarOrden(seeds);
    return true;
  }

  /** Recomendaciones pendientes visibles en Paso 2. */
  recomendacionesPendientes(): ColumnRecommendation[] {
    return this.state.recomendaciones.filter((r) => r.status === 'pending');
  }

  aceptarRecomendacion(id: string): boolean {
    const rec = this.state.recomendaciones.find((r) => r.id === id);
    if (!rec || rec.status !== 'pending') {
      return false;
    }

    this.aplicarSideEffectsRecomendacion(rec);
    this.mergeDraftSteps(rec.draftSteps);
    rec.status = 'accepted';
    return true;
  }

  descartarRecomendacion(id: string): boolean {
    const rec = this.state.recomendaciones.find((r) => r.id === id);
    if (!rec || rec.status !== 'pending') {
      return false;
    }
    rec.status = 'dismissed';
    return true;
  }

  aceptarTodasRecomendaciones(): number {
    const pending = this.recomendacionesPendientes().map((r) => r.id);
    let n = 0;
    for (const id of pending) {
      if (this.aceptarRecomendacion(id)) n += 1;
    }
    return n;
  }

  private aplicarSideEffectsRecomendacion(rec: ColumnRecommendation): void {
    if (rec.incluirColumnas.length) {
      const incluidas = new Set(this.state.columnasIncluidas);
      let excluidas = [...this.state.columnasExcluidas];
      for (const col of rec.incluirColumnas) {
        incluidas.add(col);
        excluidas = excluidas.filter((c) => c !== col);
      }
      this.setSeleccionColumnas([...incluidas], excluidas);
    }

    if (rec.mapeoHints.length) {
      const byOrigen = new Map(this.state.mapeos.map((m) => [m.columnaOrigen, m]));
      for (const hint of rec.mapeoHints) {
        const existing = byOrigen.get(hint.columnaOrigen);
        if (existing) {
          existing.columnaDestino = hint.columnaDestino;
          existing.excluida = false;
        } else {
          this.state.mapeos.push({ ...hint });
        }
      }
    }
  }

  private mergeDraftSteps(steps: ConfiguracionPlantillaDraft[]): void {
    if (!steps.length) return;

    const existingKeys = new Set(
      this.state.configuracionesDraft.map(
        (d) =>
          `${d.configuracion?.algoritmo_codigo ?? ''}|${d.columna_destino ?? ''}|${d.nombre_columna}`
      )
    );

    for (const step of steps) {
      const key = `${step.configuracion?.algoritmo_codigo ?? ''}|${step.columna_destino ?? ''}|${step.nombre_columna}`;
      if (existingKeys.has(key)) continue;
      this.state.configuracionesDraft.push(structuredClone(step));
      existingKeys.add(key);
    }

    this.state.configuracionesDraft = renumerarOrden(this.state.configuracionesDraft);
  }

  /** Convierte drafts a shape ConfiguracionPlantilla (ids temporales ok). */
  toConfiguracionesPlantilla(): ConfiguracionPlantilla[] {
    const plantillaId =
      this.state.plantillaMeta?.id ?? this.state.plantillaId ?? 'temp-wizard-plantilla';
    return this.state.configuracionesDraft.map((d) => {
      const cfg = d.configuracion
        ? {
            ...d.configuracion,
            ...(d.configuracion.algoritmo_codigo
              ? { algoritmo_codigo: d.configuracion.algoritmo_codigo }
              : {}),
            ...(d.configuracion.columnas_entrada
              ? { columnas_entrada: d.configuracion.columnas_entrada }
              : {}),
            ...(d.configuracion.parametros ?? {}),
            ...(d.configuracion.habilitado === false ? { habilitado: false } : {}),
          }
        : null;
      return {
        id: d.clientId,
        plantilla_id: plantillaId,
        nombre_columna: d.nombre_columna,
        columna_destino: d.columna_destino ?? null,
        orden: d.orden,
        tipo: d.tipo,
        algoritmo_combinado_id: d.algoritmo_combinado_id ?? null,
        configuracion: cfg,
        obligatoria: d.obligatoria,
      };
    });
  }

  private tieneHeadersMvpSeed(): boolean {
    return tieneHeadersParaSeedDemo(
      this.state.preview?.columnas ?? this.state.columnasIncluidas
    );
  }

  /** Columnas activas que llegan al mapeo (excluidas no se incluyen). */
  columnasParaMapeo(): string[] {
    return this.state.columnasIncluidas.filter((c) => !this.state.columnasExcluidas.includes(c));
  }

  /** Salidas generadas por el pipeline editable (columna_destino). */
  columnasGeneradasPipeline(): string[] {
    const outs = new Set<string>();
    for (const d of this.state.configuracionesDraft) {
      if (d.configuracion?.habilitado === false) continue;
      const out = (d.columna_destino || '').trim();
      if (out) outs.add(out);
    }
    return [...outs];
  }

  /**
   * Tras Paso 3: añade salidas del pipeline como orígenes de mapeo,
   * auto-mapea destinos estándar (FECHA_HORA→FECHA_HORA, …) y marca
   * columnas de entrada resueltas (p. ej. FECHA/HORA) como excluidas del mapeo.
   */
  sincronizarMapeosDesdePipeline(): void {
    const drafts = this.state.configuracionesDraft.filter(
      (d) => d.configuracion?.habilitado !== false
    );
    if (!drafts.length) return;

    const mapeos = [...this.state.mapeos];
    const existentes = new Set(mapeos.map((m) => m.columnaOrigen));
    const inputsResueltos = new Set<string>();

    for (const d of drafts) {
      const out = (d.columna_destino || '').trim();
      if (!out) continue;

      const entradas = d.configuracion?.columnas_entrada ?? [];
      for (const col of entradas) {
        // Orígenes usados para generar un destino estándar se consideran resueltos
        if (
          PASADA_COLUMN_KEYS.includes(out as PasadaColumnKey) ||
          out.toUpperCase() === 'FECHA_HORA'
        ) {
          inputsResueltos.add(col);
        }
      }

      if (!existentes.has(out)) {
        const autoDestino = PASADA_COLUMN_KEYS.includes(out as PasadaColumnKey)
          ? (out as PasadaColumnKey)
          : null;
        mapeos.push({
          columnaOrigen: out,
          columnaDestino: autoDestino,
          excluida: false,
        });
        existentes.add(out);
      } else {
        mapeos.forEach((m, i) => {
          if (m.columnaOrigen === out && !m.columnaDestino) {
            if (PASADA_COLUMN_KEYS.includes(out as PasadaColumnKey)) {
              mapeos[i] = {
                ...m,
                columnaDestino: out as PasadaColumnKey,
                excluida: false,
              };
            }
          }
        });
      }
    }

    // FECHA + HORA → FECHA_HORA: excluir FECHA/HORA del mapeo activo
    for (const col of inputsResueltos) {
      const idx = mapeos.findIndex((m) => m.columnaOrigen === col);
      if (idx >= 0) {
        mapeos[idx] = { ...mapeos[idx], excluida: true, columnaDestino: null };
      }
    }

    this.state.mapeos = mapeos;

    // Asegurar que salidas generadas no estén en excluidas de columnas
    const excl = this.state.columnasExcluidas.filter(
      (c) => !this.columnasGeneradasPipeline().includes(c)
    );
    this.state.columnasExcluidas = excl;
  }

  /**
   * Una plantilla puede transformar solo una parte del archivo. Conservamos en
   * Paso 5 las columnas necesarias para completar el Structure Goal aunque no
   * sean salidas del pipeline (caso Acceso Oeste: PATENTE, TARIFA y BONIFICACION).
   */
  asegurarMapeosObligatorios(): void {
    const candidatos: Partial<Record<PasadaColumnKey, string[]>> = {
      PATENTE_ID: ['PATENTE', 'DOMINIO', 'PATENTE_ID'],
      PRECIO: ['PRECIO', 'TARIFA'],
      BONIFICACION: ['BONIFICACION', 'BONIFICACION_IMPORTE'],
    };
    const disponibles = this.state.preview?.columnas ?? this.columnasParaMapeo();
    const usados = new Set(
      this.state.mapeos.filter((m) => !m.excluida && m.columnaDestino).map((m) => m.columnaDestino)
    );

    for (const [destino, nombres] of Object.entries(candidatos) as [PasadaColumnKey, string[]][]) {
      if (usados.has(destino)) continue;
      const origen = disponibles.find((columna) =>
        nombres.includes(columna.trim().toUpperCase())
      );
      if (!origen) continue;

      const existente = this.state.mapeos.find((m) => m.columnaOrigen === origen);
      if (existente) {
        existente.excluida = false;
        existente.columnaDestino = destino;
      } else {
        this.state.mapeos.push({ columnaOrigen: origen, columnaDestino: destino, excluida: false });
      }
      usados.add(destino);
    }
  }

  mapeosActivos(): MapeoColumna[] {
    return this.state.mapeos.filter((m) => !m.excluida);
  }

  facturaComoPersistible(): Omit<Factura, 'id' | 'created_at'> {
    const f = this.state.factura;
    return {
      factura: f.factura,
      cuenta: f.cuenta,
      empresa_id: f.empresa_id,
      fecha_factura: f.fecha_factura,
      importe_sin_iva: Number(f.importe_sin_iva ?? 0),
      importe_total: Number(f.importe_total ?? 0),
    };
  }

  /**
   * Construye filas estandarizadas desde preview + mapeos + relaciones estación.
   * Si hay draft del Paso 3 y ya existen `pasadasEstandarizadas` del motor,
   * preferir esas salidas (sin reaplicar helpers MVP de FECHA_HORA/PATENTE/PASE).
   */
  construirPasadasDesdeMapeo(): PasadaEstandarizada[] {
    const preview = this.state.preview;
    if (!preview) {
      return [];
    }

    const mapeoActivo = this.mapeosActivos().filter((m) => m.columnaDestino);
    const relMap = new Map(
      this.state.relacionesEstacion.map((r) => [String(r.valorProveedor), r.estacionId])
    );

    const preferMotor =
      this.state.configuracionesDraft.length > 0 && this.state.pasadasEstandarizadas.length > 0;

    if (preferMotor) {
      const motorRows = this.state.pasadasEstandarizadas;
      const filas = preview.filasOrigen.length ? preview.filasOrigen : preview.filasPreview;
      return filas.map((fila, idx) => {
        const base = motorRows[idx] ?? motorRows[Math.min(idx, motorRows.length - 1)] ?? {};
        const out: Record<string, string | number | null> = { ...base };

        for (const m of mapeoActivo) {
          const dest = m.columnaDestino!;
          const yaTiene =
            out[dest] !== null && out[dest] !== undefined && String(out[dest]).length > 0;
          // Conservar salidas del motor; completar destinos faltantes desde mapeo/origen
          if (yaTiene && dest !== 'ESTACION_ID') {
            continue;
          }

          let valor: string | number | null =
            fila[m.columnaOrigen] === undefined || fila[m.columnaOrigen] === null
              ? null
              : (fila[m.columnaOrigen] as string | number);

          if (
            dest === 'ESTACION_ID' &&
            preview.nombreArchivo.toLowerCase() === '387882.csv' &&
            fila['ESTACION'] != null &&
            fila['VIA'] != null
          ) {
            valor = `${fila['ESTACION']} - ${fila['VIA']}`;
          }

          if (dest === 'ESTACION_ID' && valor !== null) {
            const mapped = relMap.get(String(valor));
            valor = mapped ?? String(valor);
          } else if ((dest === 'PRECIO' || dest === 'BONIFICACION') && valor !== null) {
            const n = Number(String(valor).replace(',', '.'));
            valor = Number.isFinite(n) ? n : valor;
          }

          if (!yaTiene || dest === 'ESTACION_ID') {
            out[dest] = valor;
          }
        }

        if (out['ESTACION_ID'] != null) {
          const mapped = relMap.get(String(out['ESTACION_ID']));
          if (mapped) {
            out['ESTACION_ID'] = mapped;
          }
        }

        if (out['QUANTITY'] === null || out['QUANTITY'] === undefined) {
          out['QUANTITY'] = 1;
        }

        return out as PasadaEstandarizada;
      });
    }

    const colHora =
      preview.columnas.find((c) => c.toUpperCase() === 'HORA') ??
      this.state.columnasIncluidas.find((c) => c.toUpperCase() === 'HORA');

    return preview.filasOrigen.map((fila) => {
      const out: Partial<Record<PasadaColumnKey, string | number | null>> = {
        PASADA_ID: null,
        FECHA_HORA: null,
        PASE_ID: null,
        PATENTE_ID: null,
        ESTACION_ID: null,
        PRECIO: null,
        BONIFICACION: null,
        QUANTITY: 1,
        IMPORTE_NETO: null,
      };

      for (const m of mapeoActivo) {
        const dest = m.columnaDestino!;
        let valor: string | number | null =
          fila[m.columnaOrigen] === undefined || fila[m.columnaOrigen] === null
            ? null
            : (fila[m.columnaOrigen] as string | number);

        if (
          dest === 'ESTACION_ID' &&
          preview.nombreArchivo.toLowerCase() === '387882.csv' &&
          fila['ESTACION'] != null &&
          fila['VIA'] != null
        ) {
          valor = `${fila['ESTACION']} - ${fila['VIA']}`;
        }

        if (dest === 'FECHA_HORA') {
          const horaVal = colHora ? fila[colHora] : null;
          valor = combinarFechaHoraMvp(valor, horaVal);
        } else if (dest === 'PATENTE_ID') {
          valor = normalizarPatenteMvp(valor);
        } else if (dest === 'PASE_ID') {
          valor = normalizarPaseMvp(valor);
        } else if (dest === 'ESTACION_ID' && valor !== null) {
          const mapped = relMap.get(String(valor));
          valor = mapped ?? String(valor);
        } else if ((dest === 'PRECIO' || dest === 'BONIFICACION') && valor !== null) {
          const n = Number(String(valor).replace(',', '.'));
          valor = Number.isFinite(n) ? n : valor;
        }

        out[dest] = valor;
      }

      if (out.QUANTITY === null || out.QUANTITY === undefined) {
        out.QUANTITY = 1;
      }

      if (out.IMPORTE_NETO === null && out.PRECIO !== null) {
        const precio = Number(out.PRECIO);
        const bonif = Number(out.BONIFICACION ?? 0);
        const qty = Number(out.QUANTITY ?? 1);
        if (Number.isFinite(precio)) {
          out.IMPORTE_NETO =
            (precio - (Number.isFinite(bonif) ? bonif : 0)) * (Number.isFinite(qty) ? qty : 1);
        }
      }

      return out as PasadaEstandarizada;
    });
  }

  reiniciar(): void {
    this.state = estadoInicial();
  }
}
