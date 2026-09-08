import { Injectable } from '@angular/core';
import {
  AccordionPanelStatus,
} from '../../../shared';
import {
  COLUMNA_FACTURA_MASIVA,
  CONSUMOS_RESUMEN_ALIASES,
  ConfiguracionPlantilla,
  ConfirmacionCargaResultado,
  Documento,
  DocumentoTipo,
  ExcelCargaPreview,
  MapeoColumna,
  PASADA_COLUMN_KEYS,
  PasadaColumnKey,
  PasadaEstandarizada,
  RecomendacionPeajeConcesion,
  RelacionEstacionProveedor,
  ResultadoValidacionCarga,
  agruparFilasPorFactura,
  buscarColumnaPorAliases,
  concesionDominanteDeFilas,
  esColumnaMetadataMasiva,
  excelTieneColumnaFactura,
  normalizarClaveFacturaPdf,
  normalizarImportesDocumento,
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
  recipeBonificacionCero,
  recipeQuantity,
  tieneHeadersParaSeedDemo,
} from './column-recognition';
import { ConfiguracionPlantillaDraft } from './wizard-draft.types';
import {
  InvoiceAiAnalysisState,
  InvoiceAiResult,
  InvoiceAiStatus,
} from '../../services/ai/invoice/invoice-ai.models';

export type { ConfiguracionPlantillaDraft } from './wizard-draft.types';
export type { ColumnRecommendation } from './column-recognition';

export type WizardPasoId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type ModoImportacion = 'simple' | 'masiva';

export interface WizardFacturaForm {
  /** Número de documento (FACTURA). */
  factura: string;
  /** Default FC si se omite (cargas legacy / tests). */
  tipo?: DocumentoTipo;
  cuenta: string;
  empresa_id: string;
  fecha_factura: string;
  /** Bonificación de cabecera (manual; no viene del Excel). Default 0. */
  bonificacion: number | null;
  importe_sin_iva: number | null;
  percepciones: number | null;
  iva: number | null;
  importe_total: number | null;
}

/** Documento del wizard (simple = 1; masiva = N grupos por FACTURA). */
export interface WizardDocumentoGrupo extends WizardFacturaForm {
  rowIndexes: number[];
  status: AccordionPanelStatus;
  errores: string[];
  /** Valor dominante de columna Concesión (Telepase Plus / ConsumosResumen). */
  concesionProveedor?: string;
  /** Si se aplicó quitar/agregar IVA a las pasadas de este documento. */
  ivaPasadasModo?: 'original' | 'sin_iva' | 'con_iva';
  /**
   * Masiva: documento excluido del resto del flujo (validación/confirmación).
   * Se conserva en `documentos` para el resumen final.
   */
  omitido?: boolean;
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
  /** Documento activo / primero (compat flujo simple). */
  factura: WizardFacturaForm;
  /** Grupos de documento (1 en simple; N en masiva). */
  documentos: WizardDocumentoGrupo[];
  modoImportacion: ModoImportacion;
  pasadasEstandarizadas: PasadaEstandarizada[];
  validacion: ResultadoValidacionCarga | null;
  confirmacion: ConfirmacionCargaResultado | null;
  /** Resultados por documento en confirmación masiva. */
  confirmaciones: ConfirmacionCargaResultado[];
  plantillaId: string | null;
  empresaId: string | null;
  /** Pipeline editable (Paso 3) — draft local. */
  configuracionesDraft: ConfiguracionPlantillaDraft[];
  plantillaMeta: PlantillaWizardMeta | null;
  recomendacionPlantillaDescartada: boolean;
  /** JSON snapshot de configuracionesDraft al último markPipelineSaved; null = nunca guardado. */
  pipelineSnapshotSaved: string | null;
  /** Recomendaciones semánticas de columnas (F02-11). */
  recomendaciones: ColumnRecommendation[];
  /** Patentes normalizadas excluidas del import (F02-14). */
  patentesExcluidas: string[];
  /** RN-26: Concesion → Peaje detectado en Paso 5. */
  recomendacionesPeajeConcesion: RecomendacionPeajeConcesion[];
  /** PDF de factura opcional (solo memoria, importación simple). */
  invoicePdf: WizardInvoicePdf | null;
  invoiceAi: InvoiceAiAnalysisState;
  /** PDFs de factura en masiva, clave = FACTURA normalizada. */
  invoicePdfsMasiva: Record<string, WizardInvoicePdf>;
  invoicePdfsMasivaSinMatch: WizardInvoicePdf[];
  invoiceAiPorDocumento: Record<string, InvoiceAiAnalysisState>;
  /** Consentimiento Paso 8 para persistir duplicados RN-16. */
  permitirDuplicados: boolean;
}

export interface WizardInvoicePdf {
  fileName: string;
  size: number;
  lastModified: number;
  text: string;
}

const FACTURA_VACIA: WizardFacturaForm = {
  factura: '',
  tipo: 'FC',
  cuenta: '',
  empresa_id: '',
  fecha_factura: '',
  bonificacion: 0,
  importe_sin_iva: null,
  percepciones: 0,
  iva: 0,
  importe_total: null,
};

function documentoVacio(partial?: Partial<WizardDocumentoGrupo>): WizardDocumentoGrupo {
  return {
    ...FACTURA_VACIA,
    rowIndexes: [],
    status: 'neutral',
    errores: [],
    omitido: false,
    ...partial,
  };
}

function estadoInicial(): PeajesWizardState {
  const doc = documentoVacio();
  return {
    pasoActual: 1,
    preview: null,
    columnasIncluidas: [],
    columnasExcluidas: [],
    mapeos: [],
    relacionesEstacion: [],
    factura: { ...FACTURA_VACIA },
    documentos: [doc],
    modoImportacion: 'simple',
    pasadasEstandarizadas: [],
    validacion: null,
    confirmacion: null,
    confirmaciones: [],
    plantillaId: null,
    empresaId: null,
    configuracionesDraft: [],
    plantillaMeta: null,
    recomendacionPlantillaDescartada: false,
    pipelineSnapshotSaved: null,
    recomendaciones: [],
    patentesExcluidas: [],
    recomendacionesPeajeConcesion: [],
    invoicePdf: null,
    invoiceAi: { status: 'idle', result: null, error: null, fingerprint: null },
    invoicePdfsMasiva: {},
    invoicePdfsMasivaSinMatch: [],
    invoiceAiPorDocumento: {},
    permitirDuplicados: false,
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
    this.state.confirmaciones = [];
    this.state.configuracionesDraft = [];
    this.state.pipelineSnapshotSaved = null;
    this.state.patentesExcluidas = [];
    this.state.recomendacionesPeajeConcesion = [];
    this.state.recomendaciones = detectColumnRecommendations(preview);
    this.state.permitirDuplicados = false;
    this.aplicarSeleccionPorReconocimiento(preview, this.state.recomendaciones);
    this.aplicarSugerenciasSiPareceMvp(preview);
    // FACTURA / Concesión son metadata de documento/empresa, no Structure Goal.
    const metadataCols = preview.columnas.filter((c) => esColumnaMetadataMasiva(c));
    if (metadataCols.length) {
      const metaSet = new Set(metadataCols);
      const incluidas = this.state.columnasIncluidas.filter((c) => !metaSet.has(c));
      const excluidas = Array.from(new Set([...this.state.columnasExcluidas, ...metadataCols]));
      this.setSeleccionColumnas(incluidas, excluidas);
    }
    if (this.state.modoImportacion === 'masiva') {
      this.rebuildDocumentosDesdeFactura();
    } else {
      this.setDocumentos([
        documentoVacio({
          ...this.state.factura,
          empresa_id: this.state.empresaId ?? this.state.factura.empresa_id,
          rowIndexes: preview.filasOrigen.map((_, i) => i),
        }),
      ]);
    }
    this.invalidateInvoiceAi();
  }

  /**
   * F02-12: por defecto solo columnas reconocidas; el resto queda excluida (toggleable).
   * Si no hay reconocimiento, deja include-all.
   */
  private aplicarSeleccionPorReconocimiento(
    preview: ExcelCargaPreview,
    recs: ColumnRecommendation[]
  ): void {
    const reconocidas = new Set<string>();
    for (const r of recs) {
      for (const col of r.incluirColumnas) {
        reconocidas.add(col);
      }
    }
    // ESTACION sigue disponible para Paso 6 aunque ya no se sugiera una receta en Paso 2.
    const estacion = preview.columnas.find((c) => c.trim().toUpperCase() === 'ESTACION');
    if (estacion) reconocidas.add(estacion);
    if (reconocidas.size === 0) {
      return;
    }
    const incluidas = preview.columnas.filter((c) => reconocidas.has(c));
    const excluidas = preview.columnas.filter((c) => !reconocidas.has(c));
    this.setSeleccionColumnas(incluidas, excluidas);
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

  setRecomendacionesPeajeConcesion(items: RecomendacionPeajeConcesion[]): void {
    this.state.recomendacionesPeajeConcesion = items.map((i) => ({ ...i }));
  }

  setRelacionesEstacion(relaciones: RelacionEstacionProveedor[]): void {
    this.state.relacionesEstacion = relaciones.map((r) => ({ ...r }));
  }

  setModoImportacion(modo: ModoImportacion): void {
    const changed = this.state.modoImportacion !== modo;
    this.state.modoImportacion = modo;
    if (modo === 'simple' && this.state.documentos.length === 0) {
      this.state.documentos = [documentoVacio({ empresa_id: this.state.empresaId ?? '' })];
    }
    if (changed && modo === 'masiva') {
      this.invalidateInvoiceAi();
      this.state.invoicePdf = null;
    }
    if (changed && modo === 'simple') {
      this.clearInvoicePdfsMasiva();
    }
  }

  setFactura(factura: WizardFacturaForm): void {
    const next: WizardFacturaForm = { ...factura, tipo: factura.tipo ?? 'FC' };
    this.state.factura = { ...next };
    const head = this.state.documentos[0] ?? documentoVacio();
    this.state.documentos = [
      {
        ...head,
        ...next,
        rowIndexes: head.rowIndexes,
        status: head.status,
        errores: head.errores,
      },
      ...this.state.documentos.slice(1),
    ];
  }

  setDocumentos(documentos: WizardDocumentoGrupo[]): void {
    this.state.documentos = documentos.map((d) => ({
      ...d,
      tipo: d.tipo ?? 'FC',
      errores: [...(d.errores ?? [])],
      rowIndexes: [...(d.rowIndexes ?? [])],
      omitido: !!d.omitido,
    }));
    if (this.state.documentos[0]) {
      const { rowIndexes: _r, status: _s, errores: _e, omitido: _o, ...form } = this.state.documentos[0];
      this.state.factura = { ...form };
    }
  }

  patchDocumento(index: number, patch: Partial<WizardDocumentoGrupo>): void {
    const docs = [...this.state.documentos];
    if (!docs[index]) return;
    docs[index] = { ...docs[index], ...patch };
    this.setDocumentos(docs);
  }

  /**
   * Construye grupos desde la columna FACTURA (modo masiva).
   * Autocompleta número de documento; tipo default FC.
   */
  rebuildDocumentosDesdeFactura(): void {
    const preview = this.state.preview;
    const empresaId = this.state.empresaId ?? '';
    if (!preview || this.state.modoImportacion !== 'masiva') {
      this.setDocumentos([
        documentoVacio({
          ...this.state.factura,
          empresa_id: empresaId || this.state.factura.empresa_id,
          rowIndexes: preview?.filasOrigen.map((_, i) => i) ?? [],
        }),
      ]);
      return;
    }
    const grupos = agruparFilasPorFactura(preview.filasOrigen, COLUMNA_FACTURA_MASIVA);
    const colConcesion = buscarColumnaPorAliases(
      preview.columnas,
      CONSUMOS_RESUMEN_ALIASES.concesion
    );
    this.setDocumentos(
      grupos.map((g) => {
        const concesion = colConcesion
          ? concesionDominanteDeFilas(g.filas, colConcesion)
          : '';
        return documentoVacio({
          factura: g.numeroFactura,
          tipo: 'FC',
          empresa_id: empresaId,
          rowIndexes: g.rowIndexes,
          concesionProveedor: concesion || undefined,
          ivaPasadasModo: 'original',
        });
      })
    );
  }

  tieneColumnaFactura(): boolean {
    return excelTieneColumnaFactura(this.state.preview?.columnas ?? []);
  }

  setPasadasEstandarizadas(pasadas: PasadaEstandarizada[]): void {
    this.state.pasadasEstandarizadas = pasadas.map((p) => ({ ...p }));
  }

  setPatentesExcluidas(patentes: string[]): void {
    this.state.patentesExcluidas = [...patentes];
  }

  excluirPatenteDelImport(patenteNormalizada: string): void {
    const key = patenteNormalizada.trim().toUpperCase();
    if (!key || this.state.patentesExcluidas.includes(key)) {
      return;
    }
    this.state.patentesExcluidas = [...this.state.patentesExcluidas, key];
  }

  private normalizarPatenteClave(valor: unknown): string {
    return String(valor ?? '')
      .replace(/[\s-]/g, '')
      .toUpperCase();
  }

  /** Filtra pasadas cuya PATENTE_ID normalizada está en patentesExcluidas. */
  filtrarPasadasPorPatentesExcluidas(pasadas: PasadaEstandarizada[]): PasadaEstandarizada[] {
    const excluidas = new Set(this.state.patentesExcluidas);
    if (!excluidas.size) {
      return pasadas;
    }
    return pasadas.filter((p) => !excluidas.has(this.normalizarPatenteClave(p.PATENTE_ID)));
  }

  setValidacion(validacion: ResultadoValidacionCarga | null): void {
    this.state.validacion = validacion ? structuredClone(validacion) : null;
  }

  setConfirmacion(confirmacion: ConfirmacionCargaResultado | null): void {
    this.state.confirmacion = confirmacion ? structuredClone(confirmacion) : null;
  }

  setPlantillaId(id: string | null): void {
    if (this.state.plantillaId !== id) {
      this.invalidateInvoiceAi();
    }
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

  descartarRecomendacionPlantilla(): void {
    this.state.recomendacionPlantillaDescartada = true;
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
    // F14-3: descartar CATEGORIA deja Patrón A (columna excluida, sin destino).
    if (rec.kind === 'categoria' && rec.incluirColumnas.length) {
      const skip = new Set(rec.incluirColumnas);
      const incluidas = this.state.columnasIncluidas.filter((c) => !skip.has(c));
      const excluidas = Array.from(new Set([...this.state.columnasExcluidas, ...rec.incluirColumnas]));
      this.setSeleccionColumnas(incluidas, excluidas);
    }
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

  /**
   * Combina ESTACION+VIA solo si VIA está incluida en Paso 2 (F02-15).
   * Si VIA está excluida, usa el valor de ESTACION / columna origen.
   */
  private valorEstacionProveedorDesdeFila(
    fila: Record<string, unknown>,
    columnaOrigen: string,
    valorActual: string | number | null
  ): string | number | null {
    const viaIncluida = this.columnasParaMapeo().some((c) => c.toUpperCase() === 'VIA');
    if (viaIncluida && fila['ESTACION'] != null && fila['VIA'] != null) {
      const origenEsEstacion = columnaOrigen.toUpperCase() === 'ESTACION';
      if (origenEsEstacion || valorActual == null) {
        return `${fila['ESTACION']} - ${fila['VIA']}`;
      }
    }
    return valorActual;
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
      const codigo = d.configuracion?.algoritmo_codigo;
      // FILTRAR_COLUMNA no produce destino Structure Goal.
      if (codigo === 'FILTRAR_COLUMNA') continue;

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

    this.asegurarQuantityMapeoYPipeline();
  }

  /**
   * Una plantilla puede transformar solo una parte del archivo. Conservamos en
   * Paso 5 las columnas necesarias para completar el Structure Goal aunque no
   * sean salidas del pipeline (caso Acceso Oeste: PATENTE, TARIFA y BONIFICACION).
   * QUANTITY (RN-07): fila sintética + ASIGNAR_VALOR=1 si el archivo no la trae.
   * BONIFICACION: fila sintética + ASIGNAR_VALOR=0 si el proveedor no trae descuento.
   */
  asegurarMapeosObligatorios(): void {
    const candidatos: Partial<Record<PasadaColumnKey, readonly string[]>> = {
      PATENTE_ID: CONSUMOS_RESUMEN_ALIASES.patente,
      PRECIO: CONSUMOS_RESUMEN_ALIASES.precio,
      BONIFICACION: CONSUMOS_RESUMEN_ALIASES.bonificacion,
      PASE_ID: CONSUMOS_RESUMEN_ALIASES.pase,
      ESTACION_ID: CONSUMOS_RESUMEN_ALIASES.estacion,
      FECHA_HORA: CONSUMOS_RESUMEN_ALIASES.fecha,
    };
    const disponibles = this.state.preview?.columnas ?? this.columnasParaMapeo();
    const usados = new Set(
      this.state.mapeos.filter((m) => !m.excluida && m.columnaDestino).map((m) => m.columnaDestino)
    );

    for (const [destino, nombres] of Object.entries(candidatos) as [
      PasadaColumnKey,
      readonly string[],
    ][]) {
      if (usados.has(destino)) continue;
      const origen = buscarColumnaPorAliases(disponibles, nombres);
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

    this.asegurarQuantityMapeoYPipeline();
    this.asegurarBonificacionMapeoYPipeline();
    this.asegurarPrecioDesdeImporteNeto();
  }

  /**
   * RN-07: cada fila = 1 pasada. Si no hay cobertura de QUANTITY en mapeo/pipeline,
   * agrega origen sintético QUANTITY→QUANTITY y paso ASIGNAR_VALOR { valor: 1 }.
   */
  asegurarQuantityMapeoYPipeline(): void {
    const tieneMapeoQuantity = this.state.mapeos.some(
      (m) => !m.excluida && m.columnaDestino === 'QUANTITY'
    );
    if (!tieneMapeoQuantity) {
      const existente = this.state.mapeos.find((m) => m.columnaOrigen === 'QUANTITY');
      if (existente) {
        existente.excluida = false;
        existente.columnaDestino = 'QUANTITY';
      } else {
        this.state.mapeos.push({
          columnaOrigen: 'QUANTITY',
          columnaDestino: 'QUANTITY',
          excluida: false,
        });
      }
    }

    const tienePipelineQuantity = this.state.configuracionesDraft.some(
      (d) =>
        d.configuracion?.habilitado !== false &&
        (d.columna_destino === 'QUANTITY' || d.nombre_columna === 'QUANTITY')
    );
    if (!tienePipelineQuantity) {
      const maxOrden =
        this.state.configuracionesDraft.length === 0
          ? 0
          : Math.max(...this.state.configuracionesDraft.map((d) => d.orden));
      const [qtyDraft] = recipeQuantity(maxOrden + 10);
      this.state.configuracionesDraft = renumerarOrden([
        ...this.state.configuracionesDraft,
        qtyDraft,
      ]);
    }
  }

  /**
   * Proveedores sin descuento (Autopistas / Telepase): si no hay mapeo a
   * BONIFICACION (tampoco desde encabezado), agrega origen sintético +
   * ASIGNAR_VALOR { valor: 0 }. No pisa un mapeo desde columna real del archivo.
   */
  asegurarBonificacionMapeoYPipeline(): void {
    const tieneMapeoBonif = this.state.mapeos.some(
      (m) => !m.excluida && m.columnaDestino === 'BONIFICACION'
    );
    if (tieneMapeoBonif) {
      return;
    }

    const existente = this.state.mapeos.find((m) => m.columnaOrigen === 'BONIFICACION');
    if (existente) {
      existente.excluida = false;
      existente.columnaDestino = 'BONIFICACION';
    } else {
      this.state.mapeos.push({
        columnaOrigen: 'BONIFICACION',
        columnaDestino: 'BONIFICACION',
        excluida: false,
      });
    }

    const tienePipelineBonif = this.state.configuracionesDraft.some(
      (d) =>
        d.configuracion?.habilitado !== false &&
        (d.columna_destino === 'BONIFICACION' || d.nombre_columna === 'BONIFICACION')
    );
    if (!tienePipelineBonif) {
      const maxOrden =
        this.state.configuracionesDraft.length === 0
          ? 0
          : Math.max(...this.state.configuracionesDraft.map((d) => d.orden));
      const [bonifDraft] = recipeBonificacionCero(maxOrden + 10);
      this.state.configuracionesDraft = renumerarOrden([
        ...this.state.configuracionesDraft,
        bonifDraft,
      ]);
    }
  }

  /**
   * Archivos sin tarifa: si hay IMPORTE_NETO y no hay PRECIO, origina un mapeo
   * sintético. El valor se completa al estandarizar (IMPORTE_NETO + BONIFICACION).
   */
  asegurarPrecioDesdeImporteNeto(): void {
    const tienePrecio = this.state.mapeos.some((m) => !m.excluida && m.columnaDestino === 'PRECIO');
    if (tienePrecio) {
      return;
    }
    const tieneImporte = this.state.mapeos.some(
      (m) => !m.excluida && m.columnaDestino === 'IMPORTE_NETO'
    );
    if (!tieneImporte) {
      return;
    }
    const existente = this.state.mapeos.find((m) => m.columnaOrigen === 'PRECIO');
    if (existente) {
      existente.excluida = false;
      existente.columnaDestino = 'PRECIO';
    } else {
      this.state.mapeos.push({
        columnaOrigen: 'PRECIO',
        columnaDestino: 'PRECIO',
        excluida: false,
      });
    }
  }

  mapeosActivos(): MapeoColumna[] {
    return this.state.mapeos.filter((m) => !m.excluida);
  }

  documentoComoPersistible(
    doc: WizardFacturaForm = this.state.factura
  ): Omit<Documento, 'id' | 'created_at'> {
    const tipo: DocumentoTipo = doc.tipo ?? 'FC';
    const cuenta = (doc.cuenta ?? '').trim();
    const importes = normalizarImportesDocumento(tipo, {
      importe_sin_iva: Number(doc.importe_sin_iva ?? 0),
      bonificacion: Number(doc.bonificacion ?? 0),
      percepciones: Number(doc.percepciones ?? 0),
      iva: Number(doc.iva ?? 0),
      importe_total: Number(doc.importe_total ?? 0),
    });
    return {
      factura: doc.factura,
      tipo,
      cuenta: cuenta.length ? cuenta : null,
      empresa_id: doc.empresa_id,
      fecha_factura: doc.fecha_factura,
      ...importes,
    };
  }

  /** @deprecated usar documentoComoPersistible */
  facturaComoPersistible(): Omit<Documento, 'id' | 'created_at'> {
    return this.documentoComoPersistible();
  }

  /** Pasadas asociadas a los índices de fila de un documento (masiva). */
  pasadasDeDocumento(doc: WizardDocumentoGrupo, pasadas: PasadaEstandarizada[]): PasadaEstandarizada[] {
    if (this.state.modoImportacion !== 'masiva' || !doc.rowIndexes?.length) {
      return pasadas;
    }
    const set = new Set(doc.rowIndexes);
    return pasadas.filter((_, idx) => set.has(idx));
  }

  /** Documentos que siguen en el flujo (no omitidos). */
  documentosIncluidos(docs?: WizardDocumentoGrupo[]): WizardDocumentoGrupo[] {
    const list = docs ?? this.state.documentos;
    return list.filter((d) => !d.omitido);
  }

  /** Documentos omitidos (conservados para resumen final). */
  documentosOmitidos(docs?: WizardDocumentoGrupo[]): WizardDocumentoGrupo[] {
    const list = docs ?? this.state.documentos;
    return list.filter((d) => !!d.omitido);
  }

  /** Unión de pasadas de todos los documentos no omitidos (masiva). */
  pasadasDeDocumentosIncluidos(pasadas: PasadaEstandarizada[]): PasadaEstandarizada[] {
    if (this.state.modoImportacion !== 'masiva') {
      return pasadas;
    }
    const incluidos = this.documentosIncluidos();
    if (!incluidos.length) {
      return [];
    }
    const set = new Set<number>();
    for (const doc of incluidos) {
      for (const idx of doc.rowIndexes ?? []) {
        set.add(idx);
      }
    }
    return pasadas.filter((_, idx) => set.has(idx));
  }

  /**
   * Ajusta PRECIO / BONIFICACION / IMPORTE_NETO de las pasadas de un documento
   * (×1,21 o /1,21). Idempotente respecto de `ivaPasadasModo`.
   */
  ajustarIvaPasadasDocumento(
    index: number,
    modo: 'sin_iva' | 'con_iva',
    transform: (n: number) => number
  ): void {
    const doc = this.state.documentos[index];
    if (!doc?.rowIndexes?.length) return;
    if (doc.ivaPasadasModo === modo) return;

    const pasadas =
      this.state.pasadasEstandarizadas.length > 0
        ? [...this.state.pasadasEstandarizadas]
        : this.construirPasadasDesdeMapeo();
    const set = new Set(doc.rowIndexes);
    for (let i = 0; i < pasadas.length; i++) {
      if (!set.has(i)) continue;
      const p = { ...pasadas[i] } as Record<string, unknown>;
      for (const key of ['PRECIO', 'BONIFICACION', 'IMPORTE_NETO'] as const) {
        const v = Number(p[key]);
        if (Number.isFinite(v)) {
          p[key] = transform(v);
        }
      }
      pasadas[i] = p as PasadaEstandarizada;
    }
    this.setPasadasEstandarizadas(pasadas);
    this.patchDocumento(index, { ivaPasadasModo: modo });
  }

  /**
   * Filas efectivas para reconocer estaciones (Paso 6).
   * Si el motor ya filtró (FILTRAR_COLUMNA), usa `pasadasEstandarizadas`
   * (conservan columnas de origen). Si no, usa el archivo completo.
   */
  filasParaReconocimientoEstaciones(): Record<string, unknown>[] {
    const preferMotor =
      this.state.pasadasEstandarizadas.length > 0 &&
      (this.state.configuracionesDraft.length > 0 || !!this.state.plantillaId);
    if (preferMotor) {
      return this.state.pasadasEstandarizadas as Record<string, unknown>[];
    }
    const preview = this.state.preview;
    if (!preview) return [];
    return preview.filasOrigen.length ? preview.filasOrigen : preview.filasPreview;
  }

  /**
   * Construye filas estandarizadas desde preview + mapeos + relaciones estación.
   * Si hay draft del Paso 3 y ya existen `pasadasEstandarizadas` del motor,
   * preferir esas salidas (sin reaplicar helpers MVP de FECHA_HORA/PATENTE/PASE).
   * Con FILTRAR_COLUMNA el set del motor es la verdad (no se reexpande a filasOrigen).
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

    // Draft Paso 3 o plantilla aplicada (Paso 4): reutilizar salida del motor.
    // Importante: NO re-zippear contra filasOrigen — FILTRAR_COLUMNA reduce el set.
    const preferMotor =
      this.state.pasadasEstandarizadas.length > 0 &&
      (this.state.configuracionesDraft.length > 0 || !!this.state.plantillaId);

    let rows: PasadaEstandarizada[];

    if (preferMotor) {
      const motorRows = this.state.pasadasEstandarizadas;
      rows = motorRows.map((base) => {
        const fila = base as Record<string, unknown>;
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

          if (dest === 'ESTACION_ID') {
            valor = this.valorEstacionProveedorDesdeFila(fila, m.columnaOrigen, valor);
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
        if (out['BONIFICACION'] === null || out['BONIFICACION'] === undefined) {
          out['BONIFICACION'] = 0;
        }
        this.completarPrecioEImporteNeto(out);
        if (out['SENTIDO'] === undefined) out['SENTIDO'] = null;
        if (out['TARIFA_STATUS'] === undefined) out['TARIFA_STATUS'] = null;

        return out as PasadaEstandarizada;
      });
    } else {
      const colHora =
        preview.columnas.find((c) => c.toUpperCase() === 'HORA') ??
        this.state.columnasIncluidas.find((c) => c.toUpperCase() === 'HORA');

      rows = preview.filasOrigen.map((fila) => {
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
          // F14-0: opcional (Patrón A = null). Se completa si hay mapeo a CATEGORIA.
          CATEGORIA: null,
          SENTIDO: null,
          TARIFA_STATUS: null,
        };

        for (const m of mapeoActivo) {
          const dest = m.columnaDestino!;
          let valor: string | number | null =
            fila[m.columnaOrigen] === undefined || fila[m.columnaOrigen] === null
              ? null
              : (fila[m.columnaOrigen] as string | number);

          if (dest === 'ESTACION_ID') {
            valor = this.valorEstacionProveedorDesdeFila(fila, m.columnaOrigen, valor);
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
        if (out.BONIFICACION === null || out.BONIFICACION === undefined) {
          out.BONIFICACION = 0;
        }
        this.completarPrecioEImporteNeto(out);
        if (out['SENTIDO'] === undefined) out['SENTIDO'] = null;
        if (out['TARIFA_STATUS'] === undefined) out['TARIFA_STATUS'] = null;

        return out as PasadaEstandarizada;
      });
    }

    return this.filtrarPasadasPorPatentesExcluidas(rows);
  }

  /** PRECIO ← IMPORTE_NETO + BONIFICACION when tarifa is missing; inverse of IMPORTE_NETO. */
  private completarPrecioEImporteNeto(
    out: Record<string, string | number | null> | Partial<Record<PasadaColumnKey, string | number | null>>
  ): void {
    const vacio = (v: unknown) => v === null || v === undefined || v === '';
    const bonif = Number(out['BONIFICACION'] ?? 0);
    const qty = Number(out['QUANTITY'] ?? 1);
    if (vacio(out['PRECIO']) && !vacio(out['IMPORTE_NETO'])) {
      const neto = Number(out['IMPORTE_NETO']);
      if (Number.isFinite(neto)) {
        out['PRECIO'] = neto + (Number.isFinite(bonif) ? bonif : 0);
      }
    }
    if (vacio(out['IMPORTE_NETO']) && !vacio(out['PRECIO'])) {
      const precio = Number(out['PRECIO']);
      if (Number.isFinite(precio)) {
        out['IMPORTE_NETO'] =
          (precio - (Number.isFinite(bonif) ? bonif : 0)) * (Number.isFinite(qty) ? qty : 1);
      }
    }
  }

  /**
   * PDF opcional en memoria. Reemplazarlo invalida sugerencias previas.
   */
  setInvoicePdf(file: File | null, text: string | null): void {
    this.invalidateInvoiceAi();
    if (!file || text == null || !String(text).trim()) {
      this.state.invoicePdf = null;
      return;
    }
    this.state.invoicePdf = {
      fileName: file.name,
      size: file.size,
      lastModified: file.lastModified,
      text,
    };
  }

  setPermitirDuplicados(value: boolean): void {
    this.state.permitirDuplicados = value;
  }

  get permitirDuplicados(): boolean {
    return this.state.permitirDuplicados;
  }

  clavesFacturaMasiva(): string[] {
    if (this.state.modoImportacion !== 'masiva') {
      return [];
    }
    const fromDocs = this.state.documentos.map((d) => d.factura).filter((f) => !!f.trim());
    if (fromDocs.length) {
      return fromDocs;
    }
    const preview = this.state.preview;
    if (!preview) {
      return [];
    }
    return agruparFilasPorFactura(preview.filasOrigen, COLUMNA_FACTURA_MASIVA).map(
      (g) => g.numeroFactura
    );
  }

  setInvoicePdfsMasiva(
    matched: Record<string, WizardInvoicePdf>,
    unmatched: WizardInvoicePdf[] = []
  ): void {
    const prev = this.state.invoicePdfsMasiva;
    this.state.invoicePdfsMasiva = { ...matched };
    this.state.invoicePdfsMasivaSinMatch = [...unmatched];
    const keys = new Set([...Object.keys(prev), ...Object.keys(matched)]);
    for (const key of keys) {
      const previous = prev[key];
      const next = matched[key];
      const changed =
        !next ||
        !previous ||
        previous.fileName !== next.fileName ||
        previous.size !== next.size ||
        previous.lastModified !== next.lastModified;
      if (changed) {
        this.state.invoiceAiPorDocumento[key] = {
          status: 'idle',
          result: null,
          error: null,
          fingerprint: null,
        };
      }
    }
  }

  removeInvoicePdfMasiva(fileName: string): void {
    const next = { ...this.state.invoicePdfsMasiva };
    for (const [key, pdf] of Object.entries(next)) {
      if (pdf.fileName === fileName) {
        delete next[key];
        this.state.invoiceAiPorDocumento[key] = {
          status: 'idle',
          result: null,
          error: null,
          fingerprint: null,
        };
      }
    }
    this.state.invoicePdfsMasiva = next;
    this.state.invoicePdfsMasivaSinMatch = this.state.invoicePdfsMasivaSinMatch.filter(
      (pdf) => pdf.fileName !== fileName
    );
  }

  clearInvoicePdfsMasiva(): void {
    this.state.invoicePdfsMasiva = {};
    this.state.invoicePdfsMasivaSinMatch = [];
    this.state.invoiceAiPorDocumento = {};
  }

  invoicePdfMasivaFor(factura: string): WizardInvoicePdf | null {
    return this.state.invoicePdfsMasiva[normalizarClaveFacturaPdf(factura)] ?? null;
  }

  invoiceAiForDocumento(factura: string): InvoiceAiAnalysisState {
    return (
      this.state.invoiceAiPorDocumento[normalizarClaveFacturaPdf(factura)] ?? {
        status: 'idle',
        result: null,
        error: null,
        fingerprint: null,
      }
    );
  }

  setInvoiceAiPorDocumento(
    factura: string,
    status: InvoiceAiStatus,
    result: InvoiceAiResult | null,
    error: string | null
  ): void {
    const key = normalizarClaveFacturaPdf(factura);
    const net = this.invoiceExpectedNetAmountForFactura(factura);
    this.state.invoiceAiPorDocumento = {
      ...this.state.invoiceAiPorDocumento,
      [key]: {
        status,
        result,
        error,
        fingerprint:
          status === 'idle' ? null : this.invoiceAiFingerprintMasiva(key, net) ?? this.state.invoiceAiPorDocumento[key]?.fingerprint ?? null,
      },
    };
  }

  invoiceExpectedNetAmountForDocumento(doc: WizardDocumentoGrupo): number | null {
    return this.invoiceExpectedNetAmountForFactura(doc.factura, doc);
  }

  invoiceExpectedNetAmountForFactura(
    factura: string,
    doc?: WizardDocumentoGrupo
  ): number | null {
    const postTemplate =
      this.state.pasadasEstandarizadas.length > 0 &&
      (!!this.state.plantillaId || this.state.configuracionesDraft.length > 0);
    if (!postTemplate) {
      return null;
    }
    const grupo =
      doc ??
      this.state.documentos.find(
        (d) => normalizarClaveFacturaPdf(d.factura) === normalizarClaveFacturaPdf(factura)
      );
    if (!grupo) {
      return null;
    }
    const pasadas = this.state.preview
      ? this.construirPasadasDesdeMapeo()
      : this.state.pasadasEstandarizadas;
    const subset = this.pasadasDeDocumento(grupo, pasadas);
    const cents = subset.reduce((sum, pasada) => sum + this.aCentavos(pasada.IMPORTE_NETO), 0);
    return cents > 0 ? cents / 100 : null;
  }

  invoiceAiFingerprintMasiva(key: string, netAmount: number | null): string | null {
    const pdf = this.state.invoicePdfsMasiva[key];
    if (!pdf?.text || netAmount == null || netAmount <= 0) {
      return null;
    }
    return [
      key,
      pdf.fileName,
      pdf.size,
      pdf.lastModified,
      this.state.plantillaId ?? '',
      Math.round(netAmount * 100),
    ].join('|');
  }

  setInvoiceAiAnalysis(
    status: InvoiceAiStatus,
    result: InvoiceAiResult | null,
    error: string | null
  ): void {
    this.state.invoiceAi = {
      status,
      result,
      error,
      fingerprint:
        status === 'idle' ? null : this.invoiceAiFingerprint() ?? this.state.invoiceAi.fingerprint,
    };
  }

  /**
   * Neto de referencia post-plantilla (pesos), sumando IMPORTE_NETO en centavos.
   * Null si no hay plantilla aplicada, el neto no es positivo o el modo no es simple.
   */
  invoiceExpectedNetAmount(): number | null {
    if (this.state.modoImportacion !== 'simple') {
      return null;
    }
    const postTemplate =
      this.state.pasadasEstandarizadas.length > 0 &&
      (!!this.state.plantillaId || this.state.configuracionesDraft.length > 0);
    if (!postTemplate) {
      return null;
    }
    const pasadas = this.state.preview
      ? this.construirPasadasDesdeMapeo()
      : this.state.pasadasEstandarizadas;
    const cents = pasadas.reduce((sum, pasada) => sum + this.aCentavos(pasada.IMPORTE_NETO), 0);
    return cents > 0 ? cents / 100 : null;
  }

  invoiceAiFingerprint(netAmount = this.invoiceExpectedNetAmount()): string | null {
    const pdf = this.state.invoicePdf;
    if (!pdf?.text || netAmount == null || netAmount <= 0) {
      return null;
    }
    return [
      pdf.fileName,
      pdf.size,
      pdf.lastModified,
      this.state.plantillaId ?? '',
      Math.round(netAmount * 100),
    ].join('|');
  }

  private invalidateInvoiceAi(): void {
    this.state.invoiceAi = {
      status: 'idle',
      result: null,
      error: null,
      fingerprint: null,
    };
  }

  private aCentavos(valor: unknown): number {
    const numero = Number(valor);
    return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
  }

  reiniciar(): void {
    this.state = estadoInicial();
  }
}
