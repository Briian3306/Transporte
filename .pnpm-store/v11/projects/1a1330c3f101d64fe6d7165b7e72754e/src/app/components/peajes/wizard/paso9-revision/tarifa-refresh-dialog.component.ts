import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Inject, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CheckboxMultiSelectComponent,
  DateRangePickerComponent,
  DialogComponent,
  SearchSelectComponent,
} from '../../../shared';
import type { CheckboxMultiSelectOption, DateRangeValue, SearchSelectOption } from '../../../shared';
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
  TarifarioEditorDrafts,
  TarifarioEditorRow,
  TarifarioHistorialItem,
  TarifaRefrescoGuardada,
} from '../../models/tarifario.contracts';
import {
  TarifarioCandidateSelected,
  TarifarioCurrentStationMap,
  TarifarioDetectedAmount,
  TarifarioDetectedMap,
  TarifarioDraftChange,
  TarifarioEditorBoardComponent,
  TarifarioHistoryRequest,
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
import {
  agruparPendientesPorPeajeYFamilia,
  assignSafeAutocomplete,
  buildDetectedStations,
  deriveEditorGroups,
  familySentidos,
  heuristicaSeleccionInicial,
  interseccionSentidos,
  resolverRequiereNormalizacionIva,
  stationTraceViewModel,
  type AutocompleteCandidate,
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
  detected: TarifarioDetectedMap;
  currentStations: TarifarioCurrentStationMap;
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
  seleccionadas: string[];
  anchorEstacionId: string;
  tablas: TablaSentidoRefresco[];
  editors: EditorViewRefresco[];
  itemsPorEstacion: Map<string, ResultadoDetectarRefresco[]>;
  existentes: IdentidadTarifaExistente[];
  vigenteDesde: DateRangeValue;
  pendingActions: Record<string, 'CONFIRM_NEW' | 'MARK_REVIEW'>;
  assignedByCell: Record<string, string>;
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
  fechaPasada: string | null;
  vigencia: string | null;
  reason: string;
  codigo: string;
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
export class TarifaRefreshDialogComponent implements OnInit, OnChanges {
  @Input() open = false;
  @Input() resultados: ResultadoDetectarRefresco[] = [];
  @Input() candidatos: CandidatoRefrescoTarifa[] = [];
  @Input() canManage = true;
  @Input() saving = false;

  @Output() openChange = new EventEmitter<boolean>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() saved = new EventEmitter<TarifaRefrescoGuardada[]>();

  grupos: GrupoTarifaRefresco[] = [];
  loading = false;
  error: string | null = null;
  readonly sentidoOptions: SearchSelectOption[] = SENTIDO_CHOICES;
  private assignmentConflict = false;

  historyOpen = false;
  historyTitle = '';
  historyLoading = false;
  historyError: string | null = null;
  historyRows: TarifarioHistorialItem[] = [];

  constructor(
    @Inject(PEAJES_TARIFARIO_SERVICE) private readonly tarifario: PeajesTarifarioService,
    @Inject(TARIFA_REFRESH_SERVICE) private readonly refresh: TarifaRefreshService,
  ) {}

  ngOnInit(): void {
    this.reloadIfOpen();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['resultados'] || changes['candidatos']) {
      this.reloadIfOpen();
    }
  }

  get unresolved(): ResultadoDetectarRefresco[] {
    return this.resultados.filter((r) => BLOQUEANTES.has(r.codigo));
  }

  get warnings(): TarifaRefreshWarning[] {
    return this.collectWarnings();
  }

  get hasOverlapWarning(): boolean {
    return this.warnings.some((warn) => warn.code === 'solapamiento');
  }

  familyLabel(family: SentidoFamily): string {
    if (family === 'AMBAS') return 'AMBAS';
    if (family === 'DIRECCIONAL') return 'IDA y VUELTA';
    return '';
  }

  checkboxOptions(grupo: GrupoTarifaRefresco): CheckboxMultiSelectOption[] {
    return grupo.detectedStations.map((station) => ({
      value: station.estacionId,
      label: station.estacionNombre,
      style: { badgeColor: station.color, iconColor: station.color },
    }));
  }

  candidatesFor(grupo: GrupoTarifaRefresco): CandidateRailItem[] {
    const stationById = new Map(grupo.detectedStations.map((station) => [station.estacionId, station]));
    const items: CandidateRailItem[] = [];
    for (const station of grupo.detectedStations) {
      for (const result of grupo.itemsPorEstacion.get(station.estacionId) ?? []) {
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
          sentido: result.sentidoAplicado ?? result.sentidoSolicitado ?? related?.sentidoSolicitado ?? null,
          fechaPasada: result.fechaPasada ?? related?.fechaPasada ?? null,
          vigencia: vigencia ?? null,
          reason: reasonFor(result.codigo),
          codigo: result.codigo,
        });
      }
    }
    return items;
  }

  candidateCanArm(grupo: GrupoTarifaRefresco, cand: CandidateRailItem): boolean {
    return this.candidateIdentity(grupo, cand) != null;
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
    if (!change.value.trim()) {
      const editor = grupo.editors.find((item) => item.tablas.includes(tabla));
      if (editor) {
        const key = cellAssignmentKey(editor.key, tabla.sentido, change.categoria, change.status);
        delete grupo.assignedByCell[key];
      }
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
      return;
    }
    this.assignmentConflict = false;
    grupo.assignedByCell[key] = candidateId;
    this.onDraft(grupo, tabla, {
      categoria: event.categoria,
      status: event.status,
      value: String(event.candidate.valor),
    });
  }

  confirmCandidate(
    grupo: GrupoTarifaRefresco,
    candidateId: string,
    action: 'CONFIRM_NEW' | 'MARK_REVIEW',
  ): void {
    grupo.pendingActions = { ...grupo.pendingActions, [candidateId]: action };
  }

  onSentidoChange(editor: EditorViewRefresco, value: string | null): void {
    editor.sentidoSeleccionado = isTarifaSentidoValue(value) ? value : null;
  }

  onVigenteDesde(grupo: GrupoTarifaRefresco, value: DateRangeValue): void {
    grupo.vigenteDesde = { from: value.from, to: null };
  }

  async onSeleccionChange(grupo: GrupoTarifaRefresco, next: string[]): Promise<void> {
    const valid = next.filter((id) => grupo.detectedStations.some((station) => station.estacionId === id));
    grupo.seleccionadas = valid;
    grupo.anchorEstacionId = valid[0] ?? grupo.detectedStations[0]?.estacionId ?? '';
    await this.rebuildEditors(grupo);
  }

  async guardar(): Promise<void> {
    if (!this.canManage) return;
    this.error = null;
    const decisions = this.collectSaveDecisions();
    if (this.error || !decisions.length) return;
    this.saving = true;
    try {
      const saved = await this.refresh.guardar(decisions);
      this.saved.emit(saved);
      this.openChange.emit(false);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudieron guardar los cambios.';
    } finally {
      this.saving = false;
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

  private async loadGrupos(): Promise<void> {
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
        const listed = await firstValueFrom(
          this.tarifario.listar({
            filters: peajeId
              ? { peaje_ids: [peajeId] }
              : { estacion_ids: [...new Set(items.map((item) => item.estacionId))] },
            page: 1,
            pageSize: 500,
          }),
        );
        const catalogo = this.catalogoDesdeListado(listed.rows, peajeId, items);
        const existentes: IdentidadTarifaExistente[] = listed.rows.map((row) => ({
          estacionId: row.estacion_id,
          categoria: row.categoria,
          status: row.status,
          sentido: row.sentido,
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
          const grupoPendiente = { ...pending, opciones };
          const seleccionadas = heuristicaSeleccionInicial(grupoPendiente, this.candidatos);
          const grupo: GrupoTarifaRefresco = {
            ...grupoPendiente,
            detectedStations,
            seleccionadas,
            anchorEstacionId: seleccionadas[0] ?? detectedStations[0]?.estacionId ?? '',
            tablas: [],
            editors: [],
            existentes,
            vigenteDesde: { from: null, to: null },
            pendingActions: {},
            assignedByCell: {},
          };
          await this.rebuildEditors(grupo);
          grupos.push(grupo);
        }
      }
      this.grupos = grupos;
    } catch (e) {
      this.grupos = [];
      this.error = e instanceof Error ? e.message : 'No se pudo cargar el tarifario de esta estación.';
    } finally {
      this.loading = false;
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

  private async rebuildEditors(grupo: GrupoTarifaRefresco): Promise<void> {
    if (grupo.family === 'SIN_TARIFARIO') {
      grupo.editors = [];
      grupo.tablas = [];
      return;
    }
    const previous = grupo.editors;
    const derived = deriveEditorGroups({
      detectedStations: grupo.detectedStations,
      sharedStationIds: grupo.seleccionadas,
    });
    const editors: EditorViewRefresco[] = [];
    for (const group of derived) {
      editors.push(await this.buildEditorView(grupo, group, previous));
    }
    grupo.editors = editors;
    this.remapAssignedByCell(grupo, previous, editors);
    grupo.tablas = editors[0]?.tablas ?? [];
    grupo.anchorEstacionId = editors[0]?.stationIds[0] ?? grupo.detectedStations[0]?.estacionId ?? '';
  }

  private async buildEditorView(
    grupo: GrupoTarifaRefresco,
    group: EditorGroup,
    previous: readonly EditorViewRefresco[],
  ): Promise<EditorViewRefresco> {
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
      tablas.push(await this.buildTabla(grupo, editor, group, sentido, previous));
    }
    editor.tablas = tablas;
    this.applySafeAutocomplete(grupo, editor, group);
    return editor;
  }

  private async buildTabla(
    grupo: GrupoTarifaRefresco,
    editor: EditorViewRefresco,
    group: EditorGroup,
    sentido: TarifaSentido,
    previous: readonly EditorViewRefresco[],
  ): Promise<TablaSentidoRefresco> {
    const items = group.stationIds.flatMap((id) => grupo.itemsPorEstacion.get(id) ?? []);
    const currentStations: TarifarioCurrentStationMap = {};
    let maxCats = Math.max(1, ...items.map((item) => item.categoria ?? 1));
    let firstExistentes: Parameters<typeof buildEditorRows>[0] = [];
    for (const station of group.stations) {
      try {
        const payload = await firstValueFrom(
          this.tarifario.obtenerEditor(grupo.peajeId, station.estacionId, sentido),
        );
        grupo.peajeNombre = payload.context.peaje_nombre || grupo.peajeNombre;
        maxCats = Math.max(maxCats, countCategoriasEditor(payload.existentes));
        if (!firstExistentes.length) firstExistentes = payload.existentes;
        for (const existente of payload.existentes) {
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
      } catch {
        /* station without this sentido stays missing in Actual */
      }
    }
    const rows = buildEditorRows(firstExistentes, categoriasEditor(maxCats || 1));

    const drafts: TarifarioEditorDrafts = { ...this.previousDrafts(previous, group, sentido) };
    const detected: TarifarioDetectedMap = {};
    for (const row of rows) {
      drafts[row.categoria] ??= { no_pico: '', pico: '' };
    }
    for (const item of items) {
      if (item.categoria == null) continue;
      const itemSentido = item.sentidoAplicado ?? item.sentidoSolicitado;
      if (itemSentido && itemSentido !== sentido) continue;
      if (!item.status) continue;
      const station = group.stations.find((row) => row.estacionId === item.estacionId);
      const amounts = this.detectedAmounts(item, station);
      const key = detectedCellKey(item.categoria, item.status);
      detected[key] = [...(detected[key] ?? []), ...amounts];
    }
    return { sentido, rows, drafts, detected, currentStations };
  }

  private applySafeAutocomplete(
    grupo: GrupoTarifaRefresco,
    editor: EditorViewRefresco,
    group: EditorGroup,
  ): void {
    const candidates: AutocompleteCandidate[] = [];
    for (const station of group.stations) {
      for (const item of grupo.itemsPorEstacion.get(station.estacionId) ?? []) {
        const related = this.candidatos.find((c) =>
          c.rowIndexes.some((idx) => item.rowIndexes.includes(idx)),
        );
        const sentido = item.sentidoAplicado ?? item.sentidoSolicitado ?? related?.sentidoSolicitado ?? null;
        const status = item.status ?? related?.statusSolicitado ?? null;
        candidates.push({
          id: item.id,
          estacionId: station.estacionId,
          estacionNombre: station.estacionNombre,
          amount: related?.candidatePrice ?? item.candidatePrice ?? 0,
          categoria: item.categoria,
          status,
          sentido,
        });
      }
    }
    const assignment = assignSafeAutocomplete(group, candidates);
    for (const prefill of assignment.prefills) {
      const tabla = editor.tablas.find((item) => item.sentido === prefill.sentido);
      if (!tabla) continue;
      const current = tabla.drafts[prefill.categoria] ?? { no_pico: '', pico: '' };
      if (prefill.status === 'NO_PICO' && !current.no_pico.trim()) {
        tabla.drafts = { ...tabla.drafts, [prefill.categoria]: { ...current, no_pico: String(prefill.amount) } };
      } else if (prefill.status === 'PICO' && !current.pico.trim()) {
        tabla.drafts = { ...tabla.drafts, [prefill.categoria]: { ...current, pico: String(prefill.amount) } };
      }
    }
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
    return entries.map((entry) => ({
      ...entry,
      estacionId: station?.estacionId ?? item.estacionId,
      estacionNombre: station?.estacionNombre,
      color: station?.color,
      candidateId: item.id,
    }));
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

  private incompleteIdentityError(grupo: GrupoTarifaRefresco, item: CandidateRailItem): string {
    const sentido = item.sentido ?? this.editorSentidoFor(grupo, item.estacionId);
    if (sentido == null) {
      return 'El sentido IDA/VUELTA es ambiguo. Elegilo; no se infiere por el importe.';
    }
    if (item.status == null) {
      return 'El status PICO/NO_PICO es ambiguo. Elegilo antes de guardar.';
    }
    if (item.categoriaProveedor == null) {
      return 'La categoría es ambigua. Elegí una opción o marcá para revisar.';
    }
    return 'Falta identidad de tarifa para confirmar o revisar.';
  }

  private collectSaveDecisions(): TarifaRefreshDecision[] {
    const decisions: TarifaRefreshDecision[] = [];
    const seenIdentities = new Set<string>();
    const seenCandidates = new Set<string>();

    const push = (decision: TarifaRefreshDecision): boolean => {
      const identity = identityKey(
        decision.peajeId,
        decision.estacionId,
        decision.sentido,
        decision.categoriaCalculada ?? decision.categoriaProveedor,
        decision.status,
      );
      if (seenIdentities.has(identity) || seenCandidates.has(decision.candidateId)) {
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
      const incomplete = this.candidatesFor(grupo).find(
        (item) => grupo.pendingActions[item.candidateId] && !this.candidateCanArm(grupo, item),
      );
      if (incomplete) {
        this.error = this.incompleteIdentityError(grupo, incomplete);
        return [];
      }

      const reviewByIdentity = new Map<string, CandidateRailItem>();
      const confirmPending: CandidateRailItem[] = [];
      for (const item of this.candidatesFor(grupo)) {
        const action = grupo.pendingActions[item.candidateId];
        if (!action) continue;
        const identity = this.candidateIdentity(grupo, item);
        if (!identity) continue;
        if (action === 'MARK_REVIEW') {
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

        if ((confirmPending.length > 0 || uncoveredDrafts.length > 0) && !fechaIso) {
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
            categoriaCalculada:
              related?.categoriaCalculada ??
              (related != null && related.categoriaProveedor !== cell.categoria ? cell.categoria : null),
            status: cell.status,
            sentido: cell.tabla.sentido,
            importe: cell.importe,
            fechaVigenciaInicio: fechaIso,
            cases:
              related?.estacionId === estacionId
                ? related.cases
                : this.casesFor(grupo, estacionId, cell.categoria, cell.status, cell.tabla.sentido),
            requiereNormalizacionIva: resolverRequiereNormalizacionIva(
              estacionId,
              cell.categoria,
              cell.status,
              cell.tabla.sentido,
              grupo.existentes,
            ),
          })
        ) {
          return [];
        }
      }

      for (const item of reviewByIdentity.values()) {
        const identity = this.candidateIdentity(grupo, item);
        if (!identity) continue;
        if (
          !push({
            candidateId: item.candidateId,
            action: 'MARK_REVIEW',
            peajeId: grupo.peajeId,
            estacionId: item.estacionId,
            categoriaProveedor: identity.categoria,
            categoriaCalculada: item.categoriaCalculada,
            status: identity.status,
            sentido: identity.sentido,
            importe: item.amount,
            fechaVigenciaInicio: null,
            cases: item.cases,
            requiereNormalizacionIva: resolverRequiereNormalizacionIva(
              item.estacionId,
              identity.categoria,
              identity.status,
              identity.sentido,
              grupo.existentes,
            ),
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
      if (item.status !== status) continue;
      const identity = this.candidateIdentity(grupo, item);
      const sentidoItem = identity?.sentido ?? item.sentido;
      if (sentidoItem != null && sentidoItem !== sentido) continue;
      if (item.categoriaProveedor === categoria || item.categoriaCalculada === categoria) return true;
    }
    return false;
  }

  private editorSentidoFor(grupo: GrupoTarifaRefresco, estacionId: string): TarifaSentido | null {
    const editor = grupo.editors.find((item) => item.stationIds.includes(estacionId));
    return editor?.sentidoSeleccionado ?? (grupo.family === 'AMBAS' ? 'AMBAS' : null);
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
    if (codes.includes('DIRECTION_REQUIRED') || codes.includes('DIRECTION_CONFLICT')) {
      push('direccion', 'El sentido IDA/VUELTA es ambiguo. Elegilo; no se infiere por el importe.');
    }
    if (this.assignmentConflict || this.hasMultiplePricesInOneEditor()) {
      push('precios', 'Hay varios importes detectados. Asigná cada uno a una celda; no se pisan entre sí.');
    }
    push(
      'revisar',
      'Marcar para revisar guarda el candidato como REVISAR: no cierra la tarifa vigente ni la promociona.',
    );
    return list;
  }

  private hasMultiplePricesInOneEditor(): boolean {
    for (const grupo of this.grupos) {
      for (const editor of grupo.editors) {
        const amounts = new Set(
          this.candidatesFor(grupo)
            .filter((item) => editor.stationIds.includes(item.estacionId))
            .map((item) => item.amount),
        );
        if (amounts.size > 1) return true;
      }
    }
    return false;
  }
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
