import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Inject, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CheckboxMultiSelectComponent,
  DateRangePickerComponent,
  DialogComponent,
  SearchSelectComponent,
} from '../../../shared';
import type { CheckboxMultiSelectOption, DateRangeValue, SearchSelectOption } from '../../../shared';
import { ConfiguracionPlantilla } from '../../models/peajes.models';
import {
  CandidatoRefrescoTarifa,
  ResultadoDetectarRefresco,
  TARIFA_REFRESH_SERVICE,
  TarifaRefreshService,
} from '../../models/tarifa-refresh.contracts';
import {
  PEAJES_TARIFARIO_SERVICE,
  PeajesTarifarioService,
  TarifaRefreshDecision,
  TarifaSentido,
  TarifaStatusPico,
  TarifarioCurrentRow,
  TarifarioEditorDrafts,
  TarifarioEditorRow,
  TarifarioFilters,
  TarifarioHistorialImporteHit,
  TarifarioHistorialItem,
  TarifarioIdentidadExistente,
  TarifaRefrescoGuardada,
} from '../../models/tarifario.contracts';
import {
  TarifarioCandidateSelected,
  TarifarioCurrentStationMap,
  TarifarioDetectedAmount,
  TarifarioDetectedMap,
  TarifarioDraftChange,
  TarifarioEditorBoardComponent,
  TarifarioCategoryStateChange,
  TarifarioHistoryRequest,
  TarifarioIvaChange,
  TarifarioReviewStatusChange,
  TarifarioReviewCategoryChange,
  TarifarioReviewRow,
  detectedCellKey,
} from '../../tarifario/tarifario-editor-board.component';
import { TarifarioHistorialDialogComponent } from '../../tarifario/tarifario-historial-dialog.component';
import {
  buildEditorRows,
  categoriasEditor,
  collectCambios,
  collectDraftErrores,
  countCategoriasEditor,
} from '../../tarifario/tarifario.helpers';
import { nextCategoryAction, type CategoryAction } from '../../tarifario/tarifario-groups.helpers';
import {
  agruparPendientesPorPeajeYFamilia,
  applySharedSlotSelection,
  buildDetectedStations,
  checkboxOptionsForSlot,
  confirmNewVigenciaPreflight,
  deriveEditorGroups,
  familySentidos,
  findHistoryHit,
  heuristicaSeleccionInicial,
  interseccionSentidos,
  maxSharedGroupCount,
  plantillaSugiereNormalizacionIva,
  resizeSharedSlots,
  resolverRequiereNormalizacionIva,
  sharedSlotsToTarifarioGroups,
  stationTraceViewModel,
  uniqueHistoryIdentity,
  uniqueIdentityForCategory,
  resolveCategoriaEfectiva,
  withinTarifaPriceTolerance,
  hasDistinctPriceClusters,
  mergeLeftoversByIdentity,
  type DetectedStation,
  type EditorGroup,
  type EstacionCatalogoRefresco,
  type EstacionOpcionRefresco,
  type IdentidadTarifaExistente,
  type SentidoFamily,
  type StationTraceViewModel,
} from './tarifa-refresh-dialog.helpers';

export interface TablaSentidoRefresco {
  sentido: TarifaSentido;
  rows: TarifarioEditorRow[];
  drafts: TarifarioEditorDrafts;
  addedDraftCategories?: number[];
  detected: TarifarioDetectedMap;
  currentStations: TarifarioCurrentStationMap;
  reviewRows: TarifarioReviewRow[];
}

export interface EditorViewRefresco {
  key: string;
  stationIds: readonly string[];
  stations: readonly DetectedStation[];
  family: SentidoFamily;
  tablas: TablaSentidoRefresco[];
  sentidoSeleccionado: TarifaSentido | null;
  sentidoRequiereEleccion: boolean;
}

export type TarifaRefreshWarningCode =
  | 'sin-compatible'
  | 'categoria'
  | 'status'
  | 'direccion'
  | 'precios'
  | 'solapamiento'
  | 'permiso'
  | 'revisar';

export interface TarifaRefreshWarning {
  code: TarifaRefreshWarningCode;
  message: string;
}

export interface GrupoTarifaRefresco {
  key: string;
  peajeId: string;
  peajeNombre: string;
  family: SentidoFamily;
  detectedStations: DetectedStation[];
  opciones: EstacionOpcionRefresco[];
  groupCount: number;
  sharedSlots: string[][];
  anchorEstacionId: string;
  tablas: TablaSentidoRefresco[];
  editors: EditorViewRefresco[];
  itemsPorEstacion: Map<string, ResultadoDetectarRefresco[]>;
  existentes: IdentidadTarifaExistente[];
  catalogRows: TarifarioCurrentRow[];
  catalogIndex: Map<string, TarifarioIdentidadExistente[]>;
  vigenteDesde: DateRangeValue;
  pendingActions: Record<string, 'CONFIRM_NEW' | 'MARK_REVIEW'>;
  assignedByCell: Record<string, string>;
  ivaOverrides: Record<string, boolean>;
  reviewStatusByCandidate: Record<string, TarifaStatusPico | null>;
  reviewCategoryByCandidate: Record<string, number | null>;
  resolvedCandidates: Map<string, SessionResolvedIdentity>;
  historyHits: TarifarioHistorialImporteHit[];
  checkboxOptionsCache: CheckboxMultiSelectOption[][];
}

export interface CandidateRailItem {
  candidateId: string;
  estacionId: string;
  station: StationTraceViewModel;
  categoriaProveedor: number | null;
  categoriaCalculada: number | null;
  possibleCategorias: number[];
  amount: number;
  cases: number;
  status: TarifaStatusPico | null;
  sentido: TarifaSentido | null;
  possibleMatches: ResultadoDetectarRefresco['possibleMatches'];
  fechaPasada: string | null;
  vigencia: string | null;
  reason: string;
  codigo: string;
}

interface SessionResolvedIdentity {
  categoria: number;
  status: TarifaStatusPico;
  sentido: TarifaSentido;
}

const BLOQUEANTES: ReadonlySet<string> = new Set([
  'NEW_TARIFF',
  'AMBIGUOUS_TARIFF_MATCH',
  'STATUS_REQUIRED',
  'STATUS_AMBIGUOUS',
  'DIRECTION_REQUIRED',
  'DIRECTION_CONFLICT',
  'CONTEXT_INCOMPLETE',
]);

const DETECTADOS_RESUELTOS: ReadonlySet<string> = new Set([
  'CURRENT_TARIFF',
  'HISTORICAL_TARIFF_MATCH',
  'CURRENT_CATEGORY_CORRECTION',
  'HISTORICAL_CATEGORY_CORRECTION',
]);

const SENTIDO_CHOICES: SearchSelectOption[] = [
  { id: 'IDA', label: 'IDA' },
  { id: 'VUELTA', label: 'VUELTA' },
  { id: 'AMBAS', label: 'AMBAS' },
];

@Component({
  selector: 'app-tarifa-refresh-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DialogComponent,
    CheckboxMultiSelectComponent,
    DateRangePickerComponent,
    SearchSelectComponent,
    TarifarioEditorBoardComponent,
    TarifarioHistorialDialogComponent,
  ],
  templateUrl: './tarifa-refresh-dialog.component.html',
  styleUrls: [
    '../../shared/peajes-list-shell.css',
    '../../tarifario/tarifario-editor.component.css',
    './tarifa-refresh-dialog.component.css',
  ],
})
export class TarifaRefreshDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() resultados: ResultadoDetectarRefresco[] = [];
  @Input() candidatos: CandidatoRefrescoTarifa[] = [];
  @Input() configuraciones: ConfiguracionPlantilla[] = [];
  @Input() canManage = true;
  @Input() saving = false;

  @Output() openChange = new EventEmitter<boolean>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() saved = new EventEmitter<TarifaRefrescoGuardada[]>();

  grupos: GrupoTarifaRefresco[] = [];
  loading = false;
  revalidating = false;
  warnings: TarifaRefreshWarning[] = [];
  readonly sentidoOptions: SearchSelectOption[] = SENTIDO_CHOICES;
  private assignmentConflict = false;
  private errorMessage: string | null = null;

  get error(): string | null {
    return this.errorMessage;
  }

  set error(value: string | null) {
    this.errorMessage = value;
    this.refreshWarnings();
  }

  historyOpen = false;
  historyTitle = '';
  historyLoading = false;
  historyError: string | null = null;
  historyRows: TarifarioHistorialItem[] = [];

  @ViewChild(DialogComponent) private readonly dialogRef?: DialogComponent;

  constructor(
    @Inject(PEAJES_TARIFARIO_SERVICE) private readonly tarifario: PeajesTarifarioService,
    @Inject(TARIFA_REFRESH_SERVICE) private readonly refresh: TarifaRefreshService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['resultados'] || changes['candidatos']) {
      this.reloadIfOpen();
    }
    if (changes['canManage'] && !changes['canManage'].firstChange) {
      this.refreshWarnings();
    }
  }

  get unresolved(): ResultadoDetectarRefresco[] {
    return this.resultados.filter((r) => BLOQUEANTES.has(r.codigo));
  }

  get hasOverlapWarning(): boolean {
    return this.warnings.some((warn) => warn.code === 'solapamiento');
  }

  familyLabel(family: SentidoFamily): string {
    if (family === 'AMBAS') return 'AMBAS';
    if (family === 'DIRECCIONAL') return 'IDA y VUELTA';
    return '';
  }

  checkboxOptions(grupo: GrupoTarifaRefresco, slotIndex = 0): CheckboxMultiSelectOption[] {
    if (!grupo.checkboxOptionsCache || grupo.checkboxOptionsCache.length !== grupo.sharedSlots.length) {
      this.refreshCheckboxOptions(grupo);
    }
    return grupo.checkboxOptionsCache[slotIndex] ?? [];
  }

  trackGrupo(_index: number, grupo: GrupoTarifaRefresco): string {
    return grupo.key;
  }

  trackSlot(index: number): number {
    return index;
  }

  trackEditor(_index: number, editor: EditorViewRefresco): string {
    return editor.key;
  }

  trackTabla(_index: number, tabla: TablaSentidoRefresco): string {
    return tabla.sentido;
  }

  maxGroupCount(grupo: GrupoTarifaRefresco): number {
    return maxSharedGroupCount(grupo.detectedStations.length);
  }

  candidatesFor(grupo: GrupoTarifaRefresco): CandidateRailItem[] {
    return this.rawCandidatesFor(grupo).filter((item) => !grupo.resolvedCandidates.has(item.candidateId));
  }

  private rawCandidatesFor(grupo: GrupoTarifaRefresco): CandidateRailItem[] {
    const stationById = new Map(grupo.detectedStations.map((station) => [station.estacionId, station]));
    const items: CandidateRailItem[] = [];
    for (const station of grupo.detectedStations) {
      for (const result of grupo.itemsPorEstacion.get(station.estacionId) ?? []) {
        if (!BLOQUEANTES.has(result.codigo)) continue;
        const related = this.candidatos.find((c) =>
          c.rowIndexes.some((idx) => result.rowIndexes.includes(idx)),
        );
        const possible = [
          ...new Set((result.possibleMatches ?? []).map((match) => match.categoria)),
        ];
        const amount = related?.candidatePrice ?? result.candidatePrice ?? 0;
        const vigencia =
          result.fechaVigenciaInicio || result.fechaVigenciaFin
            ? [result.fechaVigenciaInicio, result.fechaVigenciaFin].filter(Boolean).join(' → ')
            : null;
        items.push({
          candidateId: result.id,
          estacionId: station.estacionId,
          station: stationTraceViewModel(stationById.get(station.estacionId) ?? station),
          categoriaProveedor: result.categoriaProveedor ?? related?.categoriaProveedor ?? result.categoria,
          categoriaCalculada: result.categoriaCalculada,
          possibleCategorias: possible,
          amount,
          cases: related?.cases ?? result.rowIndexes.length,
          status: result.status ?? related?.statusSolicitado ?? null,
          sentido:
            result.sentidoAplicado ??
            result.sentidoSolicitado ??
            related?.sentidoSolicitado ??
            null,
          possibleMatches: result.possibleMatches ?? [],
          fechaPasada: result.fechaPasada ?? related?.fechaPasada ?? null,
          vigencia: vigencia ?? null,
          reason: reasonFor(result.codigo),
          codigo: result.codigo,
        });
      }
    }
    return items;
  }

  private compatibleSessionIdentity(
    grupo: GrupoTarifaRefresco,
    candidate: CandidateRailItem,
  ): SessionResolvedIdentity | null {
    const catalog: Array<{
      key: string;
      categoria: number;
      status: TarifaStatusPico;
      sentido: TarifaSentido;
      importe: number;
    }> = [];

    for (const row of grupo.catalogRows) {
      if (row.enabled === false) continue;
      if (row.estacion_id !== candidate.estacionId || row.importe == null || row.importe <= 0) continue;
      catalog.push({
        key: `catalog:${row.tarifa_id}`,
        categoria: row.categoria,
        status: row.status,
        sentido: row.sentido,
        importe: row.importe,
      });
    }

    const drafts: typeof catalog = [];

    for (const editor of grupo.editors) {
      if (!editor.stationIds.includes(candidate.estacionId)) continue;
      for (const tabla of editor.tablas) {
        for (const row of tabla.rows) {
          const draft = tabla.drafts[row.categoria];
          for (const [status, raw] of [
            ['NO_PICO', draft?.no_pico],
            ['PICO', draft?.pico],
          ] as const) {
            if (!this.cellEnabled(tabla, row.categoria, status)) continue;
            const importe = Number(String(raw ?? '').trim().replace(',', '.'));
            if (!Number.isFinite(importe) || importe <= 0) continue;
            drafts.push({
              key: `draft:${candidate.estacionId}|${tabla.sentido}|${row.categoria}|${status}`,
              categoria: row.categoria,
              status,
              sentido: tabla.sentido,
              importe,
            });
          }
        }
      }
    }

    const draftMatches = drafts.filter((option) => this.withinPriceTolerance(candidate.amount, option.importe));
    const effective = this.effectiveCategoria(grupo, candidate);
    // Operator-typed Nuevo wins even when catalog max is below the leftover's Excel category.
    const fromDraft =
      this.uniqueCategoryIdentity(draftMatches, effective) ??
      this.uniqueCategoryIdentity(draftMatches, null);
    if (fromDraft) return fromDraft;

    const catalogMatches = catalog.filter(
      (option) =>
        this.withinPriceTolerance(candidate.amount, option.importe) &&
        (candidate.sentido == null || option.sentido === candidate.sentido || option.sentido === 'AMBAS'),
    );
    const fromCatalog = this.uniqueCategoryIdentity(catalogMatches, effective);
    if (fromCatalog) return fromCatalog;

    const possibleMatches = (candidate.possibleMatches ?? [])
      .filter(
        (option) =>
          this.withinPriceTolerance(candidate.amount, option.importe) &&
          (candidate.sentido == null || option.sentido === candidate.sentido || option.sentido === 'AMBAS'),
      )
      .map((option) => ({
        key: `possible:${option.tarifaId}`,
        categoria: option.categoria,
        status: option.status,
        sentido: option.sentido,
        importe: option.importe,
      }));
    const fromPossible = this.uniqueCategoryIdentity(possibleMatches, effective);
    if (fromPossible) return fromPossible;

    const status = grupo.reviewStatusByCandidate[candidate.candidateId] ?? candidate.status;
    if (!status) return null;
    return uniqueHistoryIdentity(
      findHistoryHit(grupo.historyHits ?? [], candidate.estacionId, candidate.amount, effective),
      status,
      effective,
    );
  }

  private uniqueCategoryIdentity(
    matches: ReadonlyArray<SessionResolvedIdentity & { key: string; importe: number }>,
    categoria: number | null,
  ): SessionResolvedIdentity | null {
    const match = uniqueIdentityForCategory(matches, categoria);
    return match ? { categoria: match.categoria, status: match.status, sentido: match.sentido } : null;
  }

  private withinPriceTolerance(candidate: number, importe: number): boolean {
    return withinTarifaPriceTolerance(candidate, importe);
  }

  candidateCanArm(grupo: GrupoTarifaRefresco, cand: CandidateRailItem): boolean {
    return this.reviewIdentity(grupo, cand) != null;
  }

  armedAction(grupo: GrupoTarifaRefresco, candidateId: string): 'CONFIRM_NEW' | 'MARK_REVIEW' | null {
    return grupo.pendingActions[candidateId] ?? null;
  }

  trackCandidate(_index: number, cand: CandidateRailItem): string {
    return cand.candidateId;
  }

  anchorNombre(grupo: GrupoTarifaRefresco): string {
    return (
      grupo.detectedStations.find((station) => station.estacionId === grupo.anchorEstacionId)?.estacionNombre ??
      grupo.opciones.find((opcion) => opcion.estacionId === grupo.anchorEstacionId)?.estacionNombre ??
      grupo.anchorEstacionId
    );
  }

  close(): void {
    this.openChange.emit(false);
    this.cancelled.emit();
  }

  onDraft(grupo: GrupoTarifaRefresco, tabla: TablaSentidoRefresco, change: TarifarioDraftChange): void {
    const current = tabla.drafts[change.categoria] ?? { no_pico: '', pico: '' };
    tabla.drafts = {
      ...tabla.drafts,
      [change.categoria]:
        change.status === 'NO_PICO'
          ? { ...current, no_pico: change.value }
          : { ...current, pico: change.value },
    };
    if (change.value.trim()) return;
    const editor = grupo.editors.find((item) => item.tablas.includes(tabla));
    if (!editor) return;
    const key = cellAssignmentKey(editor.key, tabla.sentido, change.categoria, change.status);
    const assignedId = grupo.assignedByCell[key];
    delete grupo.assignedByCell[key];
    if (assignedId && grupo.resolvedCandidates.has(assignedId)) {
      grupo.resolvedCandidates.delete(assignedId);
      this.removeDetectedCandidates(grupo, [assignedId]);
      this.assignReviewRows(grupo);
    }
  }

  onCandidateSelected(
    grupo: GrupoTarifaRefresco,
    editor: EditorViewRefresco,
    tabla: TablaSentidoRefresco,
    event: TarifarioCandidateSelected,
  ): void {
    const candidateId = event.candidate.candidateId;
    if (!candidateId) return;
    const key = cellAssignmentKey(editor.key, tabla.sentido, event.categoria, event.status);
    const existing = grupo.assignedByCell[key];
    const current = tabla.drafts[event.categoria] ?? { no_pico: '', pico: '' };
    const occupied = (event.status === 'NO_PICO' ? current.no_pico : current.pico).trim();
    if ((existing && existing !== candidateId) || (occupied && existing !== candidateId)) {
      this.assignmentConflict = true;
      this.refreshWarnings();
      return;
    }
    this.assignmentConflict = false;
    grupo.assignedByCell[key] = candidateId;
    this.onDraft(grupo, tabla, {
      categoria: event.categoria,
      status: event.status,
      value: String(event.candidate.valor),
    });
    this.refreshWarnings();
  }

  onReviewStatusChange(grupo: GrupoTarifaRefresco, event: TarifarioReviewStatusChange): void {
    grupo.reviewStatusByCandidate = {
      ...grupo.reviewStatusByCandidate,
      [event.candidateId]: event.status,
    };
    this.patchReviewRowStatus(grupo, event.candidateId, event.status);
    if (!event.status) {
      this.refreshWarnings();
      return;
    }
    const cand = this.candidatesFor(grupo).find((item) => item.candidateId === event.candidateId);
    if (!cand) {
      this.refreshWarnings();
      return;
    }
    const identity = this.reviewIdentity(grupo, cand);
    if (!identity) {
      this.refreshWarnings();
      return;
    }
    const historyIdentity = uniqueHistoryIdentity(
      findHistoryHit(grupo.historyHits ?? [], cand.estacionId, cand.amount, identity.categoria),
      event.status,
      identity.categoria,
    );
    if (historyIdentity) {
      grupo.resolvedCandidates.set(cand.candidateId, historyIdentity);
      this.rebuildEditors(grupo);
    }
    this.refreshWarnings();
  }

  onReviewCategoryChange(grupo: GrupoTarifaRefresco, event: TarifarioReviewCategoryChange): void {
    grupo.reviewCategoryByCandidate = {
      ...grupo.reviewCategoryByCandidate,
      [event.candidateId]: event.categoria,
    };
    this.patchReviewRowCategory(grupo, event.candidateId, event.categoria);
    const cand = this.candidatesFor(grupo).find((item) => item.candidateId === event.candidateId);
    const status = cand ? grupo.reviewStatusByCandidate[cand.candidateId] ?? cand.status : null;
    if (cand && status) {
      this.onReviewStatusChange(grupo, { candidateId: cand.candidateId, status });
      return;
    }
    this.refreshWarnings();
  }

  onBulkReviewStatus(
    grupo: GrupoTarifaRefresco,
    editor: EditorViewRefresco,
    status: TarifaStatusPico,
  ): void {
    for (const row of this.reviewRowsFor(grupo, editor)) {
      if (row.requiresCategoriaInput && row.categoria == null) continue;
      this.onReviewStatusChange(grupo, { candidateId: row.candidateId, status });
    }
  }

  onIvaChange(grupo: GrupoTarifaRefresco, event: TarifarioIvaChange): void {
    grupo.ivaOverrides = { ...grupo.ivaOverrides, [event.candidateId]: event.value };
    for (const editor of grupo.editors) {
      for (const tabla of editor.tablas) {
        for (const amounts of Object.values(tabla.detected)) {
          for (const amount of amounts) {
            if (amount.candidateId === event.candidateId) amount.ivaChecked = event.value;
          }
        }
      }
    }
  }

  reviewRowsFor(grupo: GrupoTarifaRefresco, editor: EditorViewRefresco): TarifarioReviewRow[] {
    return this.candidatesFor(grupo)
      .filter(
        (item) =>
          editor.stationIds.includes(item.estacionId) && !this.candidateShownInDetected(editor, item),
      )
      .map((item) => {
        const requiresCategoriaInput = item.categoriaProveedor == null;
        const categoria = requiresCategoriaInput
          ? grupo.reviewCategoryByCandidate[item.candidateId] ?? null
          : item.categoriaProveedor;
        return {
          candidateId: item.candidateId,
          valor: item.amount,
          count: item.cases,
          categoria,
          status: grupo.reviewStatusByCandidate[item.candidateId] ?? item.status,
          estacionId: item.estacionId,
          estacionNombre: item.station.estacionNombre,
          color: item.station.color,
          requiresCategoriaInput,
          categoriaError:
            requiresCategoriaInput && categoria == null
              ? 'Indicá una categoría de 0 a 10.'
              : null,
        };
      });
  }

  confirmCandidate(
    grupo: GrupoTarifaRefresco,
    candidateId: string,
    action: 'CONFIRM_NEW' | 'MARK_REVIEW',
  ): void {
    grupo.pendingActions = { ...grupo.pendingActions, [candidateId]: action };
    this.refreshWarnings();
  }

  onSentidoChange(editor: EditorViewRefresco, value: string | null): void {
    editor.sentidoSeleccionado = isTarifaSentidoValue(value) ? value : null;
  }

  onVigenteDesde(grupo: GrupoTarifaRefresco, value: DateRangeValue): void {
    grupo.vigenteDesde = { from: value.from, to: null };
  }

  async onSeleccionChange(grupo: GrupoTarifaRefresco, slotIndex: number, next: string[]): Promise<void> {
    const valid = next.filter((id) => grupo.detectedStations.some((station) => station.estacionId === id));
    grupo.sharedSlots = applySharedSlotSelection(grupo.sharedSlots, slotIndex, valid);
    grupo.anchorEstacionId = grupo.sharedSlots[0]?.[0] ?? grupo.detectedStations[0]?.estacionId ?? '';
    this.refreshCheckboxOptions(grupo);
    this.rebuildEditors(grupo, { reuseUnchanged: true });
    this.refreshWarnings();
  }

  async onGroupCountChange(grupo: GrupoTarifaRefresco, raw: string | number): Promise<void> {
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    const next = Math.min(
      this.maxGroupCount(grupo),
      Math.max(1, Number.isFinite(parsed) ? Math.trunc(parsed) : 1),
    );
    grupo.groupCount = next;
    grupo.sharedSlots = resizeSharedSlots(grupo.sharedSlots, next);
    this.refreshCheckboxOptions(grupo);
    this.rebuildEditors(grupo, { reuseUnchanged: true });
    this.refreshWarnings();
  }

  async guardar(): Promise<void> {
    if (!this.canManage) return;
    this.error = null;
    const decisions = this.collectSaveDecisions();
    if (this.error) {
      this.refreshWarnings();
      return;
    }
    if (!decisions.length) {
      if (this.grupos.every((grupo) => this.candidatesFor(grupo).length === 0)) {
        this.saved.emit([]);
        this.openChange.emit(false);
      }
      return;
    }
    this.saving = true;
    try {
      await this.enableIdentitiesForSave(decisions);
      const saved = await this.refresh.guardar(decisions);
      this.saved.emit(saved);
      this.openChange.emit(false);
    } catch (e) {
      this.error = rpcErrorMessage(e, 'No se pudieron guardar los cambios.');
      this.refreshWarnings();
    } finally {
      this.saving = false;
    }
  }

  async onCategoryStateChange(
    grupo: GrupoTarifaRefresco,
    tabla: TablaSentidoRefresco,
    change: TarifarioCategoryStateChange,
  ): Promise<void> {
    const editor = grupo.editors.find((item) => item.tablas.includes(tabla));
    const cambios = [...(editor?.stationIds ?? [])].map((estacionId) => ({
      peajeId: grupo.peajeId,
      estacionId,
      sentido: tabla.sentido,
      categoria: change.categoria,
      enabled: change.enabled,
    }));
    try {
      const result = await firstValueFrom(this.tarifario.actualizarEstadoCategorias(cambios));
      this.applyCategoryEnabled(
        grupo,
        editor?.stationIds ?? [],
        tabla.sentido,
        change.categoria,
        change.enabled,
        result,
      );
      if (!change.enabled) this.clearCategorySession(grupo, tabla, change.categoria);
      this.rebuildEditors(grupo);
      this.refreshWarnings();
    } catch {
      this.error = 'No se pudo actualizar el estado de la categoría. El valor anterior se conserva.';
    }
  }

  canAddCategoria(tabla: TablaSentidoRefresco): boolean {
    return this.nextCategory(tabla).action !== 'NONE';
  }

  nextCategory(tabla: TablaSentidoRefresco): CategoryAction {
    const identities = tabla.rows.flatMap((row) => [row.no_pico, row.pico].map((cell) => ({
      categoria: row.categoria,
      enabled: cell.enabled !== false,
      tarifaId: cell.tarifa_id,
    })));
    return nextCategoryAction(identities, 10, tabla.addedDraftCategories ?? []);
  }

  async addCategoria(grupo: GrupoTarifaRefresco, tabla: TablaSentidoRefresco): Promise<void> {
    const next = this.nextCategory(tabla);
    if (next.action === 'NONE') return;
    if (next.action === 'ENABLE') {
      const editor = grupo.editors.find((item) => item.tablas.includes(tabla));
      try {
        const result = await firstValueFrom(this.tarifario.actualizarEstadoCategorias(
          [...(editor?.stationIds ?? [])].map((estacionId) => ({
            peajeId: grupo.peajeId,
            estacionId,
            sentido: tabla.sentido,
            categoria: next.categoria,
            enabled: true,
          })),
        ));
        this.applyCategoryEnabled(
          grupo,
          editor?.stationIds ?? [],
          tabla.sentido,
          next.categoria,
          true,
          result,
        );
        tabla.addedDraftCategories = [...new Set([...(tabla.addedDraftCategories ?? []), next.categoria])];
        this.rebuildEditors(grupo);
        this.refreshWarnings();
      } catch {
        this.error = 'No se pudo habilitar la categoría existente. El estado anterior se conserva.';
      }
      return;
    }
    const row = buildEditorRows([], [next.categoria])[0];
    if (!row) return;
    if (!tabla.rows.some((candidate) => candidate.categoria === next.categoria)) {
      tabla.rows = [...tabla.rows, row];
    }
    tabla.addedDraftCategories = [...new Set([...(tabla.addedDraftCategories ?? []), next.categoria])];
    tabla.drafts = { ...tabla.drafts, [next.categoria]: { no_pico: '', pico: '' } };
  }

  async revalidarPrecios(): Promise<void> {
    if (!this.canManage || this.loading || this.saving || this.revalidating) return;
    this.error = null;
    this.revalidating = true;
    try {
      for (const grupo of this.grupos) {
        grupo.historyHits = await this.loadHistoryHits(
          grupo.peajeId,
          [...grupo.itemsPorEstacion.values()].flat(),
          grupo.catalogRows,
        );
        this.applySessionMatches(grupo);
      }
      this.refreshWarnings();
    } finally {
      this.revalidating = false;
    }
  }

  async openHistory(
    grupo: GrupoTarifaRefresco,
    tabla: TablaSentidoRefresco,
    request: TarifarioHistoryRequest,
  ): Promise<void> {
    const cell = request.status === 'NO_PICO' ? request.row.no_pico : request.row.pico;
    if (!cell.tarifa_id) return;
    this.historyTitle = `${this.anchorNombre(grupo)} · ${tabla.sentido} · Cat. ${request.row.categoria} · ${request.status}`;
    this.historyOpen = true;
    this.historyLoading = true;
    this.historyError = null;
    try {
      this.historyRows = await firstValueFrom(this.tarifario.listarHistorial(cell.tarifa_id));
    } catch {
      this.historyError = 'No se pudo cargar el historial.';
      this.historyRows = [];
    } finally {
      this.historyLoading = false;
    }
  }

  private reloadIfOpen(): void {
    if (!this.open) return;
    void this.loadGrupos();
  }

  private loadGeneration = 0;

  private async loadGrupos(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.loading = true;
    this.error = null;
    this.assignmentConflict = false;
    try {
      const byPeaje = new Map<string, ResultadoDetectarRefresco[]>();
      for (const item of this.unresolved) {
        const key = item.peajeId ?? '';
        const list = byPeaje.get(key) ?? [];
        list.push(item);
        byPeaje.set(key, list);
      }
      const grupos: GrupoTarifaRefresco[] = [];
      for (const [peajeId, items] of byPeaje) {
        if (generation !== this.loadGeneration) return;
        const catalogRows = await this.listarCatalogoCompleto(
          peajeId
            ? { peaje_ids: [peajeId], enabled: null }
            : { estacion_ids: [...new Set(items.map((item) => item.estacionId))], enabled: null },
          generation,
        );
        if (generation !== this.loadGeneration) return;
        const catalogo = this.catalogoDesdeListado(catalogRows, peajeId, items);
        const catalogIndex = this.indexCatalog(catalogRows);
        const historyHits = await this.loadHistoryHits(peajeId, items, catalogRows);
        if (generation !== this.loadGeneration) return;
        const existentes: IdentidadTarifaExistente[] = catalogRows.map((row) => ({
          estacionId: row.estacion_id,
          categoria: row.categoria,
          status: row.status,
          sentido: row.sentido,
          requiereNormalizacionIva: this.ivaHintFor(row.estacion_id, row.categoria, row.status, row.sentido),
        }));
        const detectedAll = buildDetectedStations(items, catalogo);
        for (const pending of agruparPendientesPorPeajeYFamilia(items, catalogo)) {
          const detectedStations = detectedAll.filter(
            (station) => station.peajeId === pending.peajeId && station.family === pending.family,
          );
          const opciones: EstacionOpcionRefresco[] = detectedStations.map((station) => {
            const catalogRow = catalogo.find((row) => row.estacionId === station.estacionId);
            return {
              estacionId: station.estacionId,
              estacionNombre: station.estacionNombre,
              pendiente: true,
              sentidosExistentes: catalogRow?.sentidosExistentes ?? [],
            };
          });
          const itemsPorEstacion = new Map(
            [...pending.itemsPorEstacion.entries()].map(([estacionId, rows]) => [estacionId, [...rows]]),
          );
          for (const resolved of this.resultados) {
            if (!DETECTADOS_RESUELTOS.has(resolved.codigo)) continue;
            if ((resolved.peajeId ?? '') !== peajeId || !itemsPorEstacion.has(resolved.estacionId)) continue;
            const stationItems = itemsPorEstacion.get(resolved.estacionId)!;
            if (!stationItems.some((item) => item.id === resolved.id)) stationItems.push(resolved);
          }
          const grupoPendiente = { ...pending, itemsPorEstacion, opciones };
          const seleccionadas = heuristicaSeleccionInicial(grupoPendiente, this.candidatos);
          const grupo: GrupoTarifaRefresco = {
            ...grupoPendiente,
            detectedStations,
            groupCount: 1,
            sharedSlots: [seleccionadas],
            anchorEstacionId: seleccionadas[0] ?? detectedStations[0]?.estacionId ?? '',
            tablas: [],
            editors: [],
            existentes,
            vigenteDesde: { from: null, to: null },
            pendingActions: {},
            assignedByCell: {},
            ivaOverrides: {},
            reviewStatusByCandidate: {},
            reviewCategoryByCandidate: {},
            resolvedCandidates: new Map(),
            historyHits,
            checkboxOptionsCache: [],
            catalogRows,
            catalogIndex,
          };
          this.refreshCheckboxOptions(grupo);
          this.rebuildEditors(grupo);
          this.resolveHistoryMatches(grupo);
          if (generation !== this.loadGeneration) return;
          grupos.push(grupo);
        }
      }
      if (generation !== this.loadGeneration) return;
      this.grupos = grupos;
      this.refreshWarnings();
    } catch (e) {
      if (generation !== this.loadGeneration) return;
      this.grupos = [];
      this.error = e instanceof Error ? e.message : 'No se pudo cargar el tarifario de esta estación.';
      this.refreshWarnings();
    } finally {
      if (generation === this.loadGeneration) this.loading = false;
    }
  }

  private applySessionMatches(grupo: GrupoTarifaRefresco): void {
    const resolved = new Map(grupo.resolvedCandidates);
    for (const item of this.rawCandidatesFor(grupo)) {
      const identity = this.compatibleSessionIdentity(grupo, item);
      if (identity) resolved.set(item.candidateId, identity);
    }
    grupo.resolvedCandidates = resolved;
    this.rebuildEditors(grupo);
  }

  private resolveHistoryMatches(grupo: GrupoTarifaRefresco): void {
    const resolved = new Map(grupo.resolvedCandidates);
    for (const item of this.rawCandidatesFor(grupo)) {
      const status = grupo.reviewStatusByCandidate[item.candidateId] ?? item.status;
      if (!status) continue;
      const effective = this.effectiveCategoria(grupo, item);
      const identity = uniqueHistoryIdentity(
        findHistoryHit(grupo.historyHits ?? [], item.estacionId, item.amount, effective),
        status,
        effective,
      );
      if (identity) resolved.set(item.candidateId, identity);
    }
    grupo.resolvedCandidates = resolved;
    this.rebuildEditors(grupo);
  }

  private async loadHistoryHits(
    peajeId: string,
    items: readonly ResultadoDetectarRefresco[],
    catalogRows: TarifarioCurrentRow[] = [],
  ): Promise<TarifarioHistorialImporteHit[]> {
    const consultas: Array<{ estacionId: string; importe: number; peajeId?: string; categoria?: number | null }> = [];
    const seen = new Set<string>();
    for (const item of items) {
      const related = this.candidatos.find((candidate) =>
        candidate.rowIndexes.some((idx) => item.rowIndexes.includes(idx)),
      );
      const importe = related?.candidatePrice ?? item.candidatePrice ?? 0;
      if (!item.estacionId || !(importe > 0)) continue;
      const recibida =
        item.categoriaCalculada ??
        item.categoriaProveedor ??
        related?.categoriaProveedor ??
        item.categoria ??
        related?.categoria ??
        null;
      const categoria =
        resolveCategoriaEfectiva(recibida, catalogRows, item.estacionId) ?? recibida;
      const key = `${item.estacionId}|${importe}|${categoria ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      consultas.push({
        estacionId: item.estacionId,
        importe,
        ...(peajeId ? { peajeId } : {}),
        ...(categoria != null ? { categoria } : {}),
      });
    }
    if (!consultas.length) return [];
    try {
      return await firstValueFrom(this.tarifario.buscarHistorialImportes(consultas));
    } catch {
      return [];
    }
  }

  private catalogoDesdeListado(
    rows: Array<{
      estacion_id: string;
      estacion_nombre: string;
      peaje_id: string;
      peaje_nombre: string | null;
      sentido: TarifaSentido;
    }>,
    peajeId: string,
    items: ResultadoDetectarRefresco[],
  ): EstacionCatalogoRefresco[] {
    const byEstacion = new Map<string, EstacionCatalogoRefresco>();
    for (const row of rows) {
      const existing = byEstacion.get(row.estacion_id);
      if (!existing) {
        byEstacion.set(row.estacion_id, {
          estacionId: row.estacion_id,
          estacionNombre: row.estacion_nombre,
          peajeId: row.peaje_id,
          peajeNombre: row.peaje_nombre ?? '',
          sentidosExistentes: [row.sentido],
        });
      } else if (!existing.sentidosExistentes.includes(row.sentido)) {
        existing.sentidosExistentes.push(row.sentido);
      }
    }
    for (const item of items) {
      if (byEstacion.has(item.estacionId)) continue;
      byEstacion.set(item.estacionId, {
        estacionId: item.estacionId,
        estacionNombre: item.estacionId,
        peajeId: peajeId || item.peajeId || '',
        peajeNombre: [...byEstacion.values()][0]?.peajeNombre ?? '',
        sentidosExistentes: [],
      });
    }
    return [...byEstacion.values()];
  }

  private rebuildEditors(
    grupo: GrupoTarifaRefresco,
    options: { reuseUnchanged?: boolean } = {},
  ): void {
    if (grupo.family === 'SIN_TARIFARIO') {
      grupo.editors = [];
      grupo.tablas = [];
      return;
    }
    const scrollTop = this.captureDialogScroll();
    const previous = grupo.editors;
    const previousByKey = new Map(previous.map((editor) => [editor.key, editor]));
    const derived = deriveEditorGroups({
      detectedStations: grupo.detectedStations,
      groups:
        grupo.family === 'AMBAS' || grupo.family === 'DIRECCIONAL'
          ? sharedSlotsToTarifarioGroups(grupo.sharedSlots, grupo.family)
          : [],
      sharedStationIds: grupo.sharedSlots[0] ?? [],
    });
    const editors: EditorViewRefresco[] = [];
    for (const group of derived) {
      const key = group.stationIds.join('+');
      const existing = options.reuseUnchanged ? previousByKey.get(key) : undefined;
      editors.push(existing ?? this.buildEditorView(grupo, group, previous));
    }
    grupo.editors = editors;
    this.remapAssignedByCell(grupo, previous, editors);
    this.assignReviewRows(grupo);
    grupo.tablas = editors[0]?.tablas ?? [];
    grupo.anchorEstacionId = editors[0]?.stationIds[0] ?? grupo.detectedStations[0]?.estacionId ?? '';
    this.restoreDialogScroll(scrollTop);
  }

  private buildEditorView(
    grupo: GrupoTarifaRefresco,
    group: EditorGroup,
    previous: readonly EditorViewRefresco[],
  ): EditorViewRefresco {
    const family = group.stations[0]?.family ?? grupo.family;
    const sentidosExistentes = interseccionSentidos(
      group.stations.map((station) => {
        const opcion = grupo.opciones.find((item) => item.estacionId === station.estacionId);
        return opcion?.sentidosExistentes ?? [];
      }),
    );
    const sentidos =
      family === 'DIRECCIONAL'
        ? familySentidos(family, sentidosExistentes.length ? sentidosExistentes : ['IDA', 'VUELTA'])
        : familySentidos(family, sentidosExistentes);
    const direction = this.resolveEditorDirection(grupo, group, family);
    const editor: EditorViewRefresco = {
      key: group.stationIds.join('+'),
      stationIds: group.stationIds,
      stations: group.stations,
      family,
      tablas: [],
      sentidoSeleccionado: direction.sentido,
      sentidoRequiereEleccion: direction.requiresChoice,
    };
    const tablas: TablaSentidoRefresco[] = [];
    for (const sentido of sentidos) {
      tablas.push(this.buildTabla(grupo, editor, group, sentido, previous));
    }
    editor.tablas = tablas;
    return editor;
  }

  private buildTabla(
    grupo: GrupoTarifaRefresco,
    editor: EditorViewRefresco,
    group: EditorGroup,
    sentido: TarifaSentido,
    previous: readonly EditorViewRefresco[],
  ): TablaSentidoRefresco {
    const items = group.stationIds.flatMap((id) => grupo.itemsPorEstacion.get(id) ?? []);
    const currentStations: TarifarioCurrentStationMap = {};
    let maxCats = Math.max(1, ...items.map((item) => this.displayCategoria(grupo, item) ?? 1));
    let firstExistentes: TarifarioIdentidadExistente[] = [];
    for (const station of group.stations) {
      const existentes = this.existentesDesdeCatalogo(
        grupo.catalogRows,
        station.estacionId,
        sentido,
        grupo.catalogIndex,
      );
      if (!existentes.length) continue;
      grupo.peajeNombre =
        grupo.catalogRows.find((row) => row.estacion_id === station.estacionId)?.peaje_nombre ||
        grupo.peajeNombre;
      maxCats = Math.max(maxCats, countCategoriasEditor(existentes));
      if (!firstExistentes.length) firstExistentes = existentes;
      for (const existente of existentes) {
        const key = detectedCellKey(existente.categoria, existente.status);
        currentStations[key] = [
          ...(currentStations[key] ?? []),
          {
            estacionId: station.estacionId,
            estacionNombre: station.estacionNombre,
            color: station.color,
            importe: existente.importe,
          },
        ];
      }
    }
    const rows = buildEditorRows(firstExistentes, categoriasEditor(maxCats || 1));

    const drafts: TarifarioEditorDrafts = { ...this.previousDrafts(previous, group, sentido) };
    const detected: TarifarioDetectedMap = {};
    for (const row of rows) {
      drafts[row.categoria] ??= { no_pico: '', pico: '' };
    }
    for (const item of items) {
      if (BLOQUEANTES.has(item.codigo) && !grupo.resolvedCandidates.has(item.id)) continue;
      const categoria = this.displayCategoria(grupo, item);
      if (categoria == null) continue;
      const session = grupo.resolvedCandidates.get(item.id);
      const status = session?.status ?? item.status;
      if (!status) continue;
      const itemSentido =
        session?.sentido ?? item.sentidoAplicado ?? item.sentidoSolicitado ?? editor.sentidoSeleccionado;
      if (!itemSentido || itemSentido !== sentido) continue;
      const station = group.stations.find((row) => row.estacionId === item.estacionId);
      const amounts = this.detectedAmounts(item, station).map((amount) =>
        this.decorateDetectedAmount(
          grupo,
          amount,
          item,
          categoria,
          status,
          itemSentido,
          session != null || DETECTADOS_RESUELTOS.has(item.codigo),
        ),
      );
      const key = detectedCellKey(categoria, status);
      detected[key] = [...(detected[key] ?? []), ...amounts];
    }
    return {
      sentido,
      rows,
      drafts,
      addedDraftCategories: this.previousAddedDraftCategories(previous, group, sentido),
      detected,
      currentStations,
      reviewRows: [],
    };
  }

  private assignReviewRows(grupo: GrupoTarifaRefresco): void {
    for (const editor of grupo.editors) {
      for (const tabla of editor.tablas) tabla.reviewRows = [];
      const last = editor.tablas[editor.tablas.length - 1];
      if (last) last.reviewRows = this.reviewRowsFor(grupo, editor);
    }
  }

  private existentesDesdeCatalogo(
    rows: readonly TarifarioCurrentRow[],
    estacionId: string,
    sentido: TarifaSentido,
    index?: Map<string, TarifarioIdentidadExistente[]>,
  ): TarifarioIdentidadExistente[] {
    if (index) return index.get(`${estacionId}|${sentido}`) ?? [];
    return rows
      .filter((row) => row.estacion_id === estacionId && row.sentido === sentido)
      .map((row) => ({
        tarifa_id: row.tarifa_id,
        categoria: row.categoria,
        status: row.status,
        current_tarifa_importe_id: row.current_tarifa_importe_id,
        importe: row.importe,
        fecha_actualizacion: row.fecha_actualizacion,
        enabled: row.enabled !== false,
        fechaVigenciaInicio: row.fechaVigenciaInicio ?? null,
        fechaVigenciaFin: row.fechaVigenciaFin ?? null,
        diagnostico: row.diagnostico ?? null,
        categoriaCalculada: row.categoriaCalculada ?? null,
      }));
  }

  private indexCatalog(rows: readonly TarifarioCurrentRow[]): Map<string, TarifarioIdentidadExistente[]> {
    const index = new Map<string, TarifarioIdentidadExistente[]>();
    for (const row of rows) {
      const key = `${row.estacion_id}|${row.sentido}`;
      const list = index.get(key) ?? [];
      list.push({
        tarifa_id: row.tarifa_id,
        categoria: row.categoria,
        status: row.status,
        current_tarifa_importe_id: row.current_tarifa_importe_id,
        importe: row.importe,
        fecha_actualizacion: row.fecha_actualizacion,
        enabled: row.enabled !== false,
        fechaVigenciaInicio: row.fechaVigenciaInicio ?? null,
        fechaVigenciaFin: row.fechaVigenciaFin ?? null,
        diagnostico: row.diagnostico ?? null,
        categoriaCalculada: row.categoriaCalculada ?? null,
      });
      index.set(key, list);
    }
    return index;
  }

  private previousDrafts(
    previous: readonly EditorViewRefresco[],
    group: EditorGroup,
    sentido: TarifaSentido,
  ): TarifarioEditorDrafts {
    const ids = new Set(group.stationIds);
    for (const editor of previous) {
      if (!editor.stationIds.some((id) => ids.has(id))) continue;
      const tabla = editor.tablas.find((item) => item.sentido === sentido);
      if (tabla) return { ...tabla.drafts };
    }
    return {};
  }

  private previousAddedDraftCategories(
    previous: readonly EditorViewRefresco[],
    group: EditorGroup,
    sentido: TarifaSentido,
  ): number[] {
    const ids = new Set(group.stationIds);
    for (const editor of previous) {
      if (!editor.stationIds.some((id) => ids.has(id))) continue;
      const tabla = editor.tablas.find((item) => item.sentido === sentido);
      if (tabla) return [...(tabla.addedDraftCategories ?? [])];
    }
    return [];
  }

  private applyCategoryEnabled(
    grupo: GrupoTarifaRefresco,
    stationIds: readonly string[],
    sentido: TarifaSentido,
    categoria: number,
    enabled: boolean,
    result: Array<{ tarifaId: string; enabled: boolean }>,
  ): void {
    const byId = new Map(result.map((item) => [item.tarifaId, item.enabled]));
    const stations = new Set(stationIds);
    grupo.catalogRows = grupo.catalogRows.map((row) => {
      if (byId.has(row.tarifa_id)) {
        return { ...row, enabled: byId.get(row.tarifa_id) ?? enabled };
      }
      if (stations.has(row.estacion_id) && row.sentido === sentido && row.categoria === categoria) {
        return { ...row, enabled };
      }
      return row;
    });
    grupo.catalogIndex = this.indexCatalog(grupo.catalogRows);
  }

  private clearCategorySession(
    grupo: GrupoTarifaRefresco,
    tabla: TablaSentidoRefresco,
    categoria: number,
  ): void {
    const editor = grupo.editors.find((item) => item.tablas.includes(tabla));
    const tablas = editor?.tablas.filter((item) => item.sentido === tabla.sentido) ?? [tabla];
    for (const current of tablas) {
      current.drafts = {
        ...current.drafts,
        [categoria]: { no_pico: '', pico: '' },
      };
      current.addedDraftCategories = (current.addedDraftCategories ?? []).filter((item) => item !== categoria);
      const nextDetected: TarifarioDetectedMap = { ...current.detected };
      delete nextDetected[detectedCellKey(categoria, 'NO_PICO')];
      delete nextDetected[detectedCellKey(categoria, 'PICO')];
      current.detected = nextDetected;
    }
    if (editor) {
      for (const status of ['NO_PICO', 'PICO'] as const) {
        delete grupo.assignedByCell[cellAssignmentKey(editor.key, tabla.sentido, categoria, status)];
      }
    }
    for (const [candidateId, identity] of [...grupo.resolvedCandidates.entries()]) {
      if (identity.categoria === categoria && identity.sentido === tabla.sentido) {
        grupo.resolvedCandidates.delete(candidateId);
      }
    }
  }

  private cellEnabled(
    tabla: TablaSentidoRefresco,
    categoria: number,
    status: TarifaStatusPico,
  ): boolean {
    const row = tabla.rows.find((item) => item.categoria === categoria);
    if (!row) return true;
    const cell = status === 'NO_PICO' ? row.no_pico : row.pico;
    if (!cell.tarifa_id || cell.enabled !== false) return true;
    return (tabla.addedDraftCategories ?? []).includes(categoria);
  }

  private async listarCatalogoCompleto(
    filters: TarifarioFilters,
    generation: number,
  ): Promise<TarifarioCurrentRow[]> {
    const pageSize = 100;
    const rows: TarifarioCurrentRow[] = [];
    let page = 1;
    let total = Number.POSITIVE_INFINITY;
    while (rows.length < total) {
      if (generation !== this.loadGeneration) return rows;
      const listed = await firstValueFrom(this.tarifario.listar({ filters, page, pageSize }));
      rows.push(...listed.rows);
      total = Number.isFinite(listed.total) ? listed.total : rows.length;
      if (!listed.rows.length || listed.rows.length < pageSize) break;
      page += 1;
    }
    return rows;
  }

  private async enableIdentitiesForSave(decisions: readonly TarifaRefreshDecision[]): Promise<void> {
    const seen = new Set<string>();
    const cambios: Array<{
      peajeId: string;
      estacionId: string;
      sentido: TarifaSentido;
      categoria: number;
      enabled: boolean;
    }> = [];
    for (const decision of decisions) {
      if (decision.action !== 'CONFIRM_NEW') continue;
      const categoria = decision.categoriaCalculada ?? decision.categoriaProveedor;
      if (categoria == null) continue;
      const key = `${decision.peajeId}|${decision.estacionId}|${decision.sentido}|${categoria}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cambios.push({
        peajeId: decision.peajeId,
        estacionId: decision.estacionId,
        sentido: decision.sentido,
        categoria,
        enabled: true,
      });
    }
    if (!cambios.length) return;
    const result = await firstValueFrom(this.tarifario.actualizarEstadoCategorias(cambios));
    const byId = new Map(result.map((item) => [item.tarifaId, item.enabled]));
    if (!byId.size) return;
    for (const grupo of this.grupos) {
      grupo.catalogRows = grupo.catalogRows.map((row) =>
        byId.has(row.tarifa_id) ? { ...row, enabled: byId.get(row.tarifa_id) ?? true } : row,
      );
      grupo.catalogIndex = this.indexCatalog(grupo.catalogRows);
    }
  }

  private identityEnabled(
    grupo: GrupoTarifaRefresco,
    estacionId: string,
    identity: { categoria: number; status: TarifaStatusPico; sentido: TarifaSentido },
  ): boolean {
    const rows = grupo.catalogRows.filter(
      (row) =>
        row.estacion_id === estacionId &&
        row.categoria === identity.categoria &&
        row.status === identity.status &&
        row.sentido === identity.sentido,
    );
    if (!rows.length) return true;
    return rows.some((row) => row.enabled !== false);
  }

  private resolveEditorDirection(
    grupo: GrupoTarifaRefresco,
    group: EditorGroup,
    family: SentidoFamily,
  ): { sentido: TarifaSentido | null; requiresChoice: boolean } {
    if (family === 'AMBAS') return { sentido: 'AMBAS', requiresChoice: false };
    const resolved = new Set<TarifaSentido>();
    for (const stationId of group.stationIds) {
      for (const item of grupo.itemsPorEstacion.get(stationId) ?? []) {
        const related = this.candidatos.find((c) =>
          c.rowIndexes.some((idx) => item.rowIndexes.includes(idx)),
        );
        const confidence = item.directionConfidence ?? related?.directionConfidence;
        const sentido = item.sentidoAplicado ?? item.sentidoSolicitado ?? related?.sentidoSolicitado ?? null;
        if ((confidence === 'EXPLICIT' || confidence === 'LANE_MAP') && sentido) {
          resolved.add(sentido);
        }
      }
    }
    if (resolved.size === 1) return { sentido: [...resolved][0], requiresChoice: false };
    return { sentido: null, requiresChoice: true };
  }

  private detectedAmounts(item: ResultadoDetectarRefresco, station?: DetectedStation): TarifarioDetectedAmount[] {
    const related = this.candidatos.filter((c) =>
      c.rowIndexes.some((idx) => item.rowIndexes.includes(idx)),
    );
    const counts = new Map<number, number>();
    for (const c of related) {
      counts.set(c.precioDirecto, (counts.get(c.precioDirecto) ?? 0) + c.rowIndexes.length);
    }
    const entries = counts.size
      ? [...counts.entries()].map(([valor, count]) => ({ valor, count }))
      : item.candidatePrice != null
        ? [{ valor: item.candidatePrice, count: item.rowIndexes.length }]
        : [];
    return entries.map((entry) => {
      const amount: TarifarioDetectedAmount = {
        ...entry,
        estacionId: station?.estacionId ?? item.estacionId,
        estacionNombre: station?.estacionNombre,
        color: station?.color,
        candidateId: item.id,
      };
      return amount;
    });
  }

  private casesFor(
    grupo: GrupoTarifaRefresco,
    estacionId: string,
    categoria: number,
    status: TarifaStatusPico,
    sentido: TarifaSentido,
  ): number {
    const items = grupo.itemsPorEstacion.get(estacionId) ?? [];
    return items
      .filter((item) => {
        const itemSentido = item.sentidoAplicado ?? item.sentidoSolicitado;
        return (
          item.categoria === categoria &&
          (item.status == null || item.status === status) &&
          (itemSentido == null || itemSentido === sentido)
        );
      })
      .reduce((sum, item) => sum + item.rowIndexes.length, 0);
  }

  private remapAssignedByCell(
    grupo: GrupoTarifaRefresco,
    previous: readonly EditorViewRefresco[],
    editors: readonly EditorViewRefresco[],
  ): void {
    const next: Record<string, string> = {};
    for (const [oldKey, candidateId] of Object.entries(grupo.assignedByCell)) {
      const parsed = parseAssignmentKey(oldKey);
      if (!parsed) continue;
      const oldEditor = previous.find((item) => item.key === parsed.editorKey);
      const oldStations = new Set(oldEditor?.stationIds ?? parsed.editorKey.split('+').filter(Boolean));
      for (const editor of editors) {
        if (!editor.stationIds.some((id) => oldStations.has(id))) continue;
        next[cellAssignmentKey(editor.key, parsed.sentido, parsed.categoria, parsed.status)] = candidateId;
      }
    }
    grupo.assignedByCell = next;
  }

  private candidateIdentity(
    grupo: GrupoTarifaRefresco,
    cand: CandidateRailItem,
  ): { categoria: number; status: TarifaStatusPico; sentido: TarifaSentido } | null {
    const sentido = cand.sentido ?? this.editorSentidoFor(grupo, cand.estacionId);
    if (cand.categoriaProveedor == null || cand.status == null || sentido == null) return null;
    return { categoria: cand.categoriaProveedor, status: cand.status, sentido };
  }

  /**
   * Pico / No pico confirms into the effective category (LEAST of received
   * and station max) or the category typed by the operator. Never writes the
   * last catalogue category.
   */
  private reviewIdentity(
    grupo: GrupoTarifaRefresco,
    cand: CandidateRailItem,
  ): { categoria: number; status: TarifaStatusPico; sentido: TarifaSentido } | null {
    const status = grupo.reviewStatusByCandidate[cand.candidateId] ?? cand.status;
    if (!status) return null;
    const sentido: TarifaSentido = grupo.family === 'AMBAS' ? 'AMBAS' : 'IDA';
    const categoria = this.effectiveCategoria(grupo, cand);
    if (categoria == null) return null;
    return { categoria, status, sentido };
  }

  private effectiveCategoria(grupo: GrupoTarifaRefresco, cand: CandidateRailItem): number | null {
    const manual = grupo.reviewCategoryByCandidate[cand.candidateId];
    if (manual != null) {
      return resolveCategoriaEfectiva(manual, grupo.catalogRows, cand.estacionId) ?? manual;
    }
    return resolveCategoriaEfectiva(cand.categoriaProveedor, grupo.catalogRows, cand.estacionId);
  }

  private candidateShownInDetected(editor: EditorViewRefresco, item: CandidateRailItem): boolean {
    return editor.tablas.some((tabla) =>
      Object.values(tabla.detected).some((amounts) =>
        amounts.some((amount) => amount.candidateId === item.candidateId),
      ),
    );
  }

  private decorateDetectedAmount(
    grupo: GrupoTarifaRefresco,
    amount: TarifarioDetectedAmount,
    item: ResultadoDetectarRefresco,
    categoria: number,
    status: TarifaStatusPico,
    sentido: TarifaSentido,
    readOnly: boolean,
  ): TarifarioDetectedAmount {
    const estacionId = amount.estacionId ?? item.estacionId;
    const candidateId = item.id;
    const iva =
      categoria == null
        ? plantillaSugiereNormalizacionIva(this.configuraciones)
        : this.ivaFor(grupo, estacionId, categoria, status, sentido, candidateId);
    return {
      ...amount,
      showIva: !readOnly && iva != null,
      ivaChecked:
        typeof grupo.ivaOverrides?.[candidateId] === 'boolean'
          ? grupo.ivaOverrides[candidateId]
          : iva === true,
      readOnly,
    };
  }

  private displayCategoria(grupo: GrupoTarifaRefresco, item: ResultadoDetectarRefresco): number | null {
    return grupo.resolvedCandidates.get(item.id)?.categoria ?? item.categoriaCalculada ?? item.categoriaProveedor ?? item.categoria;
  }

  private showIvaFor(grupo: GrupoTarifaRefresco, item: CandidateRailItem): boolean {
    const identity = this.candidateIdentity(grupo, item);
    if (!identity) return true;
    return (
      this.ivaFor(grupo, item.estacionId, identity.categoria, identity.status, identity.sentido, item.candidateId) !=
      null
    );
  }

  private ivaCheckedFor(grupo: GrupoTarifaRefresco, item: CandidateRailItem): boolean {
    if (typeof grupo.ivaOverrides?.[item.candidateId] === 'boolean') {
      return grupo.ivaOverrides[item.candidateId];
    }
    const identity = this.candidateIdentity(grupo, item);
    if (!identity) return plantillaSugiereNormalizacionIva(this.configuraciones);
    return (
      this.ivaFor(grupo, item.estacionId, identity.categoria, identity.status, identity.sentido, item.candidateId) ===
      true
    );
  }

  private ivaFor(
    grupo: GrupoTarifaRefresco,
    estacionId: string,
    categoria: number,
    status: TarifaStatusPico,
    sentido: TarifaSentido,
    candidateId?: string,
  ): boolean | null {
    const hasOverride = candidateId != null && Object.prototype.hasOwnProperty.call(grupo.ivaOverrides ?? {}, candidateId);
    return resolverRequiereNormalizacionIva(estacionId, categoria, status, sentido, grupo.existentes, {
      override: hasOverride ? grupo.ivaOverrides![candidateId!] : undefined,
      plantillaSugiere: plantillaSugiereNormalizacionIva(this.configuraciones),
    });
  }

  private ivaHintFor(
    estacionId: string,
    categoria: number,
    status: TarifaStatusPico,
    sentido: TarifaSentido,
  ): boolean | null {
    const match = this.resultados.find(
      (row) =>
        row.estacionId === estacionId &&
        row.categoria === categoria &&
        row.status === status &&
        (row.sentidoAplicado === sentido || row.sentidoSolicitado === sentido) &&
        typeof row.requiereNormalizacionIva === 'boolean',
    );
    return match?.requiereNormalizacionIva ?? null;
  }

  private incompleteIdentityError(grupo: GrupoTarifaRefresco, item: CandidateRailItem): string {
    const status = grupo.reviewStatusByCandidate[item.candidateId] ?? item.status;
    if (this.effectiveCategoria(grupo, item) == null) {
      return 'Indicá la categoría (0–10) para asociar el importe.';
    }
    if (status == null) {
      return 'El status PICO/NO_PICO es ambiguo. Elegilo antes de guardar.';
    }
    return 'No hay una tarifa activa en esta estación para asociar el importe en revisión.';
  }

  private collectSaveDecisions(): TarifaRefreshDecision[] {
    const decisions: TarifaRefreshDecision[] = [];
    const seenIdentities = new Set<string>();
    const seenCandidates = new Set<string>();

    const push = (decision: TarifaRefreshDecision): boolean => {
      const categoria = decision.categoriaCalculada ?? decision.categoriaProveedor;
      if (categoria == null) {
        this.error = 'Indicá la categoría (0–10) para asociar el importe.';
        return false;
      }
      const identity = identityKey(
        decision.peajeId,
        decision.estacionId,
        decision.sentido,
        categoria,
        decision.status,
      );
      if (seenCandidates.has(decision.candidateId)) {
        this.error = 'Hay identidades duplicadas. Corregilas antes de guardar.';
        return false;
      }
      if (seenIdentities.has(identity)) {
        if (decision.action === 'MARK_REVIEW') return true;
        if (decision.action === 'CONFIRM_NEW' && decision.noCoincideConTarifario === true) {
          seenCandidates.add(decision.candidateId);
          decisions.push(decision);
          return true;
        }
        this.error = 'Hay identidades duplicadas. Corregilas antes de guardar.';
        return false;
      }
      seenIdentities.add(identity);
      seenCandidates.add(decision.candidateId);
      decisions.push(decision);
      return true;
    };

    for (const grupo of this.grupos) {
      if (grupo.family === 'SIN_TARIFARIO') {
        this.error = 'No hay un tarifario cargado para esta estación. No se puede crear un sentido desde la carga.';
        return [];
      }
      const fechaIso = toIsoDate(grupo.vigenteDesde.from);
      if (Object.values(grupo.pendingActions).includes('CONFIRM_NEW') && !fechaIso) {
        this.error = 'Indicá la fecha de Vigente desde para confirmar tarifas nuevas.';
        return [];
      }
      const incomplete = this.candidatesFor(grupo).find((item) => !this.candidateCanArm(grupo, item));
      if (incomplete) {
        this.error = this.incompleteIdentityError(grupo, incomplete);
        return [];
      }

      const reviewByIdentity = new Map<string, CandidateRailItem>();
      const reviewItems: CandidateRailItem[] = [];
      const confirmPending: CandidateRailItem[] = [];
      for (const item of this.candidatesFor(grupo)) {
        const action = grupo.pendingActions[item.candidateId];
        if (!action) continue;
        const identity = action === 'MARK_REVIEW'
          ? this.reviewIdentity(grupo, item)
          : this.candidateIdentity(grupo, item);
        if (!identity || !this.identityEnabled(grupo, item.estacionId, identity)) continue;
        if (action === 'MARK_REVIEW') {
          reviewItems.push(item);
          reviewByIdentity.set(
            identityKey(grupo.peajeId, item.estacionId, identity.sentido, identity.categoria, identity.status),
            item,
          );
        } else {
          confirmPending.push(item);
        }
      }

      const draftCells: Array<{
        editor: EditorViewRefresco;
        tabla: TablaSentidoRefresco;
        categoria: number;
        status: TarifaStatusPico;
        importe: number;
      }> = [];
      for (const editor of grupo.editors) {
        if (!editor.tablas.length) continue;
        for (const tabla of editor.tablas) {
          const errores = collectDraftErrores(tabla.rows, tabla.drafts);
          if (errores.length) {
            this.error = 'Hay importes inválidos. Corregilos antes de guardar.';
            return [];
          }
          for (const cambio of collectCambios(tabla.rows, tabla.drafts)) {
            if (!this.cellEnabled(tabla, cambio.categoria, cambio.status)) continue;
            draftCells.push({
              editor,
              tabla,
              categoria: cambio.categoria,
              status: cambio.status,
              importe: cambio.importe,
            });
          }
        }
      }

        const uncoveredDrafts = draftCells.flatMap((cell) =>
          cell.editor.stationIds
            .filter(
              (estacionId) =>
                !this.reviewCovers(
                  grupo,
                  reviewByIdentity,
                  identityKey(grupo.peajeId, estacionId, cell.tabla.sentido, cell.categoria, cell.status),
                  estacionId,
                  cell.tabla.sentido,
                  cell.status,
                  cell.categoria,
                ),
            )
            .map((estacionId) => ({ cell, estacionId })),
        );

        const leftoverItems = this.candidatesFor(grupo).filter((item) => {
          if (grupo.pendingActions[item.candidateId]) return false;
          const identity = this.reviewIdentity(grupo, item);
          if (!identity || !this.identityEnabled(grupo, item.estacionId, identity)) return false;
          if (this.nuevoCoversCandidate(grupo, item, identity)) return false;
          return true;
        });

        const leftoverPrepared = leftoverItems.flatMap((item) => {
          const identity = this.reviewIdentity(grupo, item);
          if (!identity) return [];
          return [
            {
              identityKey: identityKey(grupo.peajeId, item.estacionId, identity.sentido, identity.categoria, identity.status),
              amount: item.amount,
              cases: item.cases,
              fechaPasada: item.fechaPasada,
              item,
              identity,
            },
          ];
        });
        const leftoverMerge = mergeLeftoversByIdentity(leftoverPrepared);
        if ((confirmPending.length > 0 || uncoveredDrafts.length > 0 || leftoverItems.length > 0) && !fechaIso) {
          this.error = 'Indicá la fecha de Vigente desde para confirmar tarifas nuevas.';
          return [];
        }

        for (const pending of confirmPending) {
          const identity = this.candidateIdentity(grupo, pending);
          if (!identity) continue;
          const covered = draftCells.some((cell) => this.confirmDraftCovers(grupo, pending, identity, cell));
          if (!covered) {
            this.error = 'Completá el importe en Nuevo para confirmar la tarifa.';
            return [];
          }
        }

      for (const { cell, estacionId } of uncoveredDrafts) {
        if (!this.cellEnabled(cell.tabla, cell.categoria, cell.status)) continue;
        const catalogIdentity = grupo.catalogRows.find(
          (row) =>
            row.estacion_id === estacionId &&
            row.sentido === cell.tabla.sentido &&
            row.categoria === cell.categoria &&
            row.status === cell.status &&
            row.enabled !== false,
        );
        const preflight = confirmNewVigenciaPreflight({
          importe: cell.importe,
          fechaVigenciaInicio: fechaIso,
          catalog: catalogIdentity
            ? {
                importe: catalogIdentity.importe,
                fechaVigenciaInicio: catalogIdentity.fechaVigenciaInicio ?? null,
                estacionNombre: catalogIdentity.estacion_nombre,
                categoria: catalogIdentity.categoria,
                status: catalogIdentity.status,
              }
            : null,
        });
        if (preflight.kind === 'omit') continue;
        if (preflight.kind === 'error') {
          this.error = preflight.message;
          return [];
        }
        const related = this.relatedCandidate(
          grupo,
          cell.editor,
          cell.tabla,
          estacionId,
          cell.categoria,
          cell.status,
        );
        if (
          !push({
            candidateId: related?.candidateId ?? typedCandidateId(estacionId, cell.tabla.sentido, cell.categoria, cell.status),
            action: 'CONFIRM_NEW',
            peajeId: grupo.peajeId,
            estacionId,
            categoriaProveedor: related?.categoriaProveedor ?? cell.categoria,
            categoriaCalculada: resolvedCategoriaCalculada(related?.categoriaProveedor, cell.categoria),
            status: cell.status,
            sentido: cell.tabla.sentido,
            importe: cell.importe,
            fechaVigenciaInicio: fechaIso,
            cases:
              related?.estacionId === estacionId
                ? related.cases
                : this.casesFor(grupo, estacionId, cell.categoria, cell.status, cell.tabla.sentido),
            requiereNormalizacionIva: this.ivaFor(
              grupo,
              estacionId,
              cell.categoria,
              cell.status,
              cell.tabla.sentido,
              related?.candidateId,
            ),
          })
        ) {
          return [];
        }
      }

      for (const item of reviewItems) {
        const identity = this.reviewIdentity(grupo, item);
        if (!identity || !this.identityEnabled(grupo, item.estacionId, identity)) continue;
        if (
          !push({
            candidateId: item.candidateId,
            action: 'MARK_REVIEW',
            peajeId: grupo.peajeId,
            estacionId: item.estacionId,
            categoriaProveedor: item.categoriaProveedor ?? identity.categoria,
            categoriaCalculada: resolvedCategoriaCalculada(item.categoriaProveedor, identity.categoria),
            status: identity.status,
            sentido: identity.sentido,
            importe: item.amount,
            fechaVigenciaInicio: null,
            cases: item.cases,
            requiereNormalizacionIva: this.ivaFor(
              grupo,
              item.estacionId,
              identity.categoria,
              identity.status,
              identity.sentido,
              item.candidateId,
            ),
          })
        ) {
          return [];
        }
      }

      for (const leftover of leftoverMerge.merged) {
        const item = leftover.item;
        const identity = leftover.identity;
        if (!this.identityEnabled(grupo, item.estacionId, identity)) continue;
        if (seenCandidates.has(item.candidateId)) continue;
        const catalogIdentity = grupo.catalogRows.find(
          (row) =>
            row.estacion_id === item.estacionId &&
            row.sentido === identity.sentido &&
            row.categoria === identity.categoria &&
            row.status === identity.status &&
            row.enabled !== false,
        );
        const preflight = confirmNewVigenciaPreflight({
          importe: leftover.amount,
          fechaVigenciaInicio: fechaIso,
          forcePersist: true,
          catalog: catalogIdentity
            ? {
                importe: catalogIdentity.importe,
                fechaVigenciaInicio: catalogIdentity.fechaVigenciaInicio ?? null,
                estacionNombre: catalogIdentity.estacion_nombre,
                categoria: catalogIdentity.categoria,
                status: catalogIdentity.status,
              }
            : null,
        });
        if (preflight.kind === 'error') {
          this.error = preflight.message;
          return [];
        }
        if (
          !push({
            candidateId: item.candidateId,
            action: 'CONFIRM_NEW',
            peajeId: grupo.peajeId,
            estacionId: item.estacionId,
            categoriaProveedor: item.categoriaProveedor,
            categoriaCalculada: resolvedCategoriaCalculada(item.categoriaProveedor, identity.categoria) ?? identity.categoria,
            status: identity.status,
            sentido: identity.sentido,
            importe: leftover.amount,
            fechaVigenciaInicio: fechaIso,
            cases: leftover.cases,
            requiereNormalizacionIva: this.ivaFor(
              grupo,
              item.estacionId,
              identity.categoria,
              identity.status,
              identity.sentido,
              item.candidateId,
            ),
            noCoincideConTarifario: true,
          })
        ) {
          return [];
        }
      }
    }
    return decisions;
  }

  private relatedCandidate(
    grupo: GrupoTarifaRefresco,
    editor: EditorViewRefresco,
    tabla: TablaSentidoRefresco,
    estacionId: string,
    categoria: number,
    status: TarifaStatusPico,
  ): CandidateRailItem | null {
    const assignedId = grupo.assignedByCell[cellAssignmentKey(editor.key, tabla.sentido, categoria, status)];
    const stationCandidates = this.candidatesFor(grupo).filter((item) => item.estacionId === estacionId);
    if (assignedId) {
      const own = stationCandidates.find((item) => item.candidateId === assignedId);
      if (own) return own;
    }
    return (
      stationCandidates.find((item) => {
        const identity = this.candidateIdentity(grupo, item);
        return (
          identity != null &&
          identity.categoria === categoria &&
          identity.status === status &&
          identity.sentido === tabla.sentido
        );
      }) ??
      stationCandidates.find(
        (item) =>
          item.categoriaProveedor === categoria &&
          item.status === status &&
          (item.sentido == null || item.sentido === tabla.sentido),
      ) ??
      null
    );
  }

  private confirmDraftCovers(
    grupo: GrupoTarifaRefresco,
    pending: CandidateRailItem,
    identity: { categoria: number; status: TarifaStatusPico; sentido: TarifaSentido },
    cell: {
      editor: EditorViewRefresco;
      tabla: TablaSentidoRefresco;
      categoria: number;
      status: TarifaStatusPico;
    },
  ): boolean {
    if (!cell.editor.stationIds.includes(pending.estacionId)) return false;
    if (cell.tabla.sentido !== identity.sentido) return false;
    if (cell.status !== identity.status) return false;
    const assignedId =
      grupo.assignedByCell[cellAssignmentKey(cell.editor.key, cell.tabla.sentido, cell.categoria, cell.status)];
    if (assignedId === pending.candidateId) return true;
    const calculated = pending.categoriaCalculada;
    return cell.categoria === identity.categoria || (calculated != null && cell.categoria === calculated);
  }

  private reviewCovers(
    grupo: GrupoTarifaRefresco,
    reviewByIdentity: Map<string, CandidateRailItem>,
    cellKey: string,
    estacionId: string,
    sentido: TarifaSentido,
    status: TarifaStatusPico,
    categoria: number,
  ): boolean {
    if (reviewByIdentity.has(cellKey)) return true;
    for (const item of reviewByIdentity.values()) {
      if (item.estacionId !== estacionId) continue;
      const identity = this.reviewIdentity(grupo, item);
      if (!identity || identity.status !== status || identity.sentido !== sentido) continue;
      if (identity.categoria === categoria) return true;
    }
    return false;
  }

  private editorSentidoFor(grupo: GrupoTarifaRefresco, estacionId: string): TarifaSentido | null {
    const editor = grupo.editors.find((item) => item.stationIds.includes(estacionId));
    return editor?.sentidoSeleccionado ?? (grupo.family === 'AMBAS' ? 'AMBAS' : null);
  }

  private refreshCheckboxOptions(grupo: GrupoTarifaRefresco): void {
    grupo.checkboxOptionsCache = grupo.sharedSlots.map((_, index) =>
      checkboxOptionsForSlot(grupo.detectedStations, grupo.sharedSlots, index),
    );
  }

  private patchReviewRowCategory(
    grupo: GrupoTarifaRefresco,
    candidateId: string,
    categoria: number | null,
  ): void {
    for (const editor of grupo.editors) {
      for (const tabla of editor.tablas) {
        const row = tabla.reviewRows.find((item) => item.candidateId === candidateId);
        if (!row) continue;
        row.categoria = categoria;
        row.categoriaError =
          row.requiresCategoriaInput && categoria == null ? 'Indicá una categoría de 0 a 10.' : null;
      }
    }
  }

  private patchReviewRowStatus(
    grupo: GrupoTarifaRefresco,
    candidateId: string,
    status: TarifaStatusPico | null,
  ): void {
    for (const editor of grupo.editors) {
      for (const tabla of editor.tablas) {
        const row = tabla.reviewRows.find((item) => item.candidateId === candidateId);
        if (row) row.status = status;
      }
    }
  }

  private removeDetectedCandidates(grupo: GrupoTarifaRefresco, candidateIds: readonly string[]): void {
    const ids = new Set(candidateIds);
    for (const editor of grupo.editors) {
      for (const tabla of editor.tablas) {
        const next: TarifarioDetectedMap = {};
        for (const [key, amounts] of Object.entries(tabla.detected)) {
          const kept = amounts.filter((amount) => !ids.has(amount.candidateId ?? ''));
          if (kept.length) next[key] = kept;
        }
        tabla.detected = next;
      }
    }
  }

  private captureDialogScroll(): number {
    return this.dialogBody()?.scrollTop ?? 0;
  }

  private restoreDialogScroll(scrollTop: number): void {
    const apply = (): void => {
      const body = this.dialogBody();
      if (body) body.scrollTop = scrollTop;
    };
    apply();
    queueMicrotask(apply);
  }

  private dialogBody(): HTMLElement | null {
    return this.dialogRef?.panel?.nativeElement.querySelector('.app-dialog__body') ?? null;
  }

  private refreshWarnings(): void {
    this.warnings = this.collectWarnings();
  }

  private collectWarnings(): TarifaRefreshWarning[] {
    const list: TarifaRefreshWarning[] = [];
    const push = (code: TarifaRefreshWarningCode, message: string): void => {
      if (!list.some((item) => item.code === code)) list.push({ code, message });
    };
    if (!this.canManage) {
      push('permiso', 'Necesitás permiso peajes:manage para guardar tarifas nuevas.');
    }
    if (this.error && /solap/i.test(this.error)) {
      push('solapamiento', this.error);
    }
    const codes = this.unresolved.map((item) => item.codigo);
    if (codes.includes('NEW_TARIFF')) {
      push('sin-compatible', 'No hay una tarifa compatible para este importe detectado.');
    }
    if (codes.includes('AMBIGUOUS_TARIFF_MATCH')) {
      push('categoria', 'La categoría es ambigua. Elegí una opción o marcá para revisar.');
    }
    if (codes.includes('STATUS_REQUIRED') || codes.includes('STATUS_AMBIGUOUS')) {
      push('status', 'El status PICO/NO_PICO es ambiguo. Elegilo antes de guardar.');
    }
    if (this.hasDirectionalAmbiguity()) {
      push('direccion', 'El sentido IDA/VUELTA es ambiguo. Elegilo; no se infiere por el importe.');
    }
    if (this.assignmentConflict || this.hasMultiplePricesInOneEditor()) {
      push('precios', 'Hay varios importes detectados. Asigná cada uno a una celda; no se pisan entre sí.');
    }
    if (this.leftoverWouldMarkReview()) {
      push(
        'revisar',
        'Marcar para revisar guarda el candidato como REVISAR: no cierra la tarifa vigente ni la promociona.',
      );
    }
    return list;
  }

  private hasDirectionalAmbiguity(): boolean {
    return this.grupos.some((grupo) => {
      if (grupo.family === 'AMBAS') return false;
      return [...grupo.itemsPorEstacion.values()]
        .flat()
        .some((item) => item.codigo === 'DIRECTION_REQUIRED' || item.codigo === 'DIRECTION_CONFLICT');
    });
  }

  private leftoverWouldMarkReview(): boolean {
    return this.grupos.some((grupo) => Object.values(grupo.pendingActions).includes('MARK_REVIEW'));
  }

  private nuevoCoversCandidate(
    grupo: GrupoTarifaRefresco,
    item: CandidateRailItem,
    identity: { categoria: number; status: TarifaStatusPico; sentido: TarifaSentido },
  ): boolean {
    for (const editor of grupo.editors) {
      if (!editor.stationIds.includes(item.estacionId)) continue;
      for (const tabla of editor.tablas) {
        if (tabla.sentido !== identity.sentido) continue;
        const draft = tabla.drafts[identity.categoria];
        const raw = identity.status === 'NO_PICO' ? draft?.no_pico : draft?.pico;
        if (String(raw ?? '').trim()) return true;
        const assignedId =
          grupo.assignedByCell[cellAssignmentKey(editor.key, tabla.sentido, identity.categoria, identity.status)];
        if (assignedId === item.candidateId) return true;
      }
    }
    return false;
  }

  private hasMultiplePricesInOneEditor(): boolean {
    for (const grupo of this.grupos) {
      for (const editor of grupo.editors) {
        const assigned = new Set(Object.values(grupo.assignedByCell));
        const byIdentity = new Map<string, number[]>();
        for (const item of this.candidatesFor(grupo)) {
          if (!editor.stationIds.includes(item.estacionId)) continue;
          if (assigned.has(item.candidateId) || grupo.resolvedCandidates.has(item.candidateId)) continue;
          const identity = this.reviewIdentity(grupo, item);
          const key = identity
            ? identityKey(grupo.peajeId, item.estacionId, identity.sentido, identity.categoria, identity.status)
            : `unresolved|${item.estacionId}`;
          const list = byIdentity.get(key) ?? [];
          list.push(item.amount);
          byIdentity.set(key, list);
        }
        for (const [key, list] of byIdentity) {
          if (!key.startsWith('unresolved|')) continue;
          if (hasDistinctPriceClusters(list)) {
            return true;
          }
        }
      }
    }
    return false;
  }
}

function rpcErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim();
    if (message) return message;
  }
  return fallback;
}

function reasonFor(codigo: string): string {
  switch (codigo) {
    case 'NEW_TARIFF':
      return 'No hay una tarifa compatible';
    case 'AMBIGUOUS_TARIFF_MATCH':
      return 'Hay más de una tarifa compatible';
    case 'STATUS_REQUIRED':
    case 'STATUS_AMBIGUOUS':
      return 'El status PICO/NO_PICO es ambiguo';
    case 'DIRECTION_REQUIRED':
    case 'DIRECTION_CONFLICT':
      return 'El sentido IDA/VUELTA es ambiguo';
    case 'CONTEXT_INCOMPLETE':
      return 'Falta contexto para asociar la tarifa';
    default:
      return codigo;
  }
}

function cellAssignmentKey(
  editorKey: string,
  sentido: TarifaSentido,
  categoria: number,
  status: TarifaStatusPico,
): string {
  return `${editorKey}|${sentido}|${categoria}|${status}`;
}

function parseAssignmentKey(
  key: string,
): { editorKey: string; sentido: TarifaSentido; categoria: number; status: TarifaStatusPico } | null {
  const parts = key.split('|');
  if (parts.length !== 4) return null;
  const [editorKey, sentido, categoriaRaw, status] = parts;
  if (!isTarifaSentidoValue(sentido)) return null;
  if (status !== 'PICO' && status !== 'NO_PICO') return null;
  const categoria = Number(categoriaRaw);
  if (!Number.isFinite(categoria)) return null;
  return { editorKey, sentido, categoria, status };
}

function isTarifaSentidoValue(value: string | null | undefined): value is TarifaSentido {
  return value === 'IDA' || value === 'VUELTA' || value === 'AMBAS';
}

function toIsoDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function identityKey(
  peajeId: string,
  estacionId: string,
  sentido: TarifaSentido,
  categoria: number,
  status: TarifaStatusPico,
): string {
  return `${peajeId}|${estacionId}|${sentido}|${categoria}|${status}`;
}

function typedCandidateId(
  estacionId: string,
  sentido: TarifaSentido,
  categoria: number,
  status: TarifaStatusPico,
): string {
  return `typed:${estacionId}|${sentido}|${categoria}|${status}`;
}

function resolvedCategoriaCalculada(
  proveedor: number | null | undefined,
  identityCategoria: number,
): number | null {
  return proveedor === identityCategoria ? null : identityCategoria;
}
