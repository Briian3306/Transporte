import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TarifaSentido,
  TarifaStatusPico,
  TarifarioEditorCell,
  TarifarioEditorDrafts,
  TarifarioEditorRow,
} from '../models/tarifario.contracts';
import {
  MISSING_IMPORTE_LABEL,
  TARIFARIO_CATEGORIAS_MAX,
  formatFechaActualizacion,
  formatTarifaImporte,
  formatTarifaImporteDisplay,
  isBlankTarifaImporteInput,
  parseTarifaImporte,
} from './tarifario.helpers';
import { categoryStateForIdentities } from './tarifario-groups.helpers';

export interface TarifarioDetectedAmount {
  valor: number;
  count: number;
  estacionId?: string;
  estacionNombre?: string;
  color?: string;
  candidateId?: string;
  showIva?: boolean;
  ivaChecked?: boolean;
  /** A matched tariff is informative only; selecting it must not create a draft. */
  readOnly?: boolean;
}

export interface TarifarioReviewRow {
  candidateId: string;
  valor: number;
  count: number;
  categoria: number | null;
  status: TarifaStatusPico | null;
  estacionId?: string;
  estacionNombre?: string;
  color?: string;
  requiresCategoriaInput?: boolean;
  categoriaError?: string | null;
}

export interface TarifarioReviewStatusChange {
  candidateId: string;
  status: TarifaStatusPico | null;
}

export interface TarifarioReviewCategoryChange {
  candidateId: string;
  categoria: number | null;
}

export interface TarifarioIvaChange {
  candidateId: string;
  value: boolean;
}

export type TarifarioDetectedMap = Record<string, TarifarioDetectedAmount[]>;

export interface TarifarioStationCurrent {
  estacionId: string;
  estacionNombre: string;
  color: string;
  importe: number | null;
}

export type TarifarioCurrentStationMap = Record<string, TarifarioStationCurrent[]>;

export interface TarifarioGroupedCurrentSingle {
  kind: 'single';
}

export interface TarifarioGroupedCurrentShared {
  kind: 'shared';
  importe: number | null;
  stations: TarifarioStationCurrent[];
}

export interface TarifarioGroupedCurrentSplit {
  kind: 'split';
  stations: TarifarioStationCurrent[];
}

export type TarifarioGroupedCurrent =
  | TarifarioGroupedCurrentSingle
  | TarifarioGroupedCurrentShared
  | TarifarioGroupedCurrentSplit;

export interface TarifarioDraftChange {
  categoria: number;
  status: TarifaStatusPico;
  value: string;
}

export interface TarifarioCandidateSelected {
  categoria: number;
  status: TarifaStatusPico;
  candidate: TarifarioDetectedAmount;
}

export interface TarifarioHistoryRequest {
  row: TarifarioEditorRow;
  status: TarifaStatusPico;
}

export interface TarifarioCategoryStateChange {
  categoria: number;
  enabled: boolean;
  tarifaIds: string[];
}

export interface TarifarioNuevoNavigateOut {
  direction: 'next' | 'prev';
  consumed: boolean;
}

export function detectedCellKey(categoria: number, status: TarifaStatusPico): string {
  return `${categoria}:${status}`;
}

export function groupCurrentAmounts(
  stations: readonly TarifarioStationCurrent[],
): TarifarioGroupedCurrent {
  if (!stations.length) return { kind: 'single' };
  const importe = stations[0].importe;
  const same = stations.every((station) => station.importe === importe);
  if (same) return { kind: 'shared', importe, stations: [...stations] };
  return { kind: 'split', stations: [...stations] };
}

@Component({
  selector: 'app-tarifario-editor-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tarifario-editor-board.component.html',
  styleUrls: ['./tarifario-editor-board.component.css'],
})
export class TarifarioEditorBoardComponent implements OnChanges {
  @ViewChildren('nuevoInput') private readonly nuevoInputs?: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChild('addCategoriaBtn') private readonly addCategoriaBtn?: ElementRef<HTMLButtonElement>;

  readonly missing = MISSING_IMPORTE_LABEL;
  readonly categoriasMax = TARIFARIO_CATEGORIAS_MAX;
  readonly lanes: ReadonlyArray<{ status: TarifaStatusPico; lane: 'nopico' | 'pico' }> = [
    { status: 'NO_PICO', lane: 'nopico' },
    { status: 'PICO', lane: 'pico' },
  ];
  private nuevoFocusKey: string | null = null;
  private currentViewCache = new Map<string, TarifarioGroupedCurrent>();
  private currentViewStations: TarifarioCurrentStationMap | null = null;
  private currentViewRows: TarifarioEditorRow[] | null = null;
  private visibleRowsSource: {
    rows: TarifarioEditorRow[];
    drafts: TarifarioEditorDrafts;
    draftCategories: number[];
  } | null = null;
  private cachedVisibleRows: TarifarioEditorRow[] = [];

  @Input() rows: TarifarioEditorRow[] = [];
  @Input() drafts: TarifarioEditorDrafts = {};
  @Input() detected: TarifarioDetectedMap = {};
  @Input() currentStations: TarifarioCurrentStationMap = {};
  @Input() reviewRows: TarifarioReviewRow[] = [];
  @Input() allowAddCategoria = true;
  @Input() categoriaCount = 0;
  @Input() nextCategoria = 0;
  @Input() nextCategoryAction: 'ENABLE' | 'DRAFT' | 'NONE' = 'NONE';
  /** Categories explicitly opened by Add Category, including still-empty drafts. */
  @Input() draftCategories: number[] = [];
  @Input() showAddCategoria = true;

  @Output() readonly draftChange = new EventEmitter<TarifarioDraftChange>();
  @Output() readonly candidateSelected = new EventEmitter<TarifarioCandidateSelected>();
  @Output() readonly historyRequest = new EventEmitter<TarifarioHistoryRequest>();
  @Output() readonly addCategoria = new EventEmitter<void>();
  @Output() readonly reviewStatusChange = new EventEmitter<TarifarioReviewStatusChange>();
  @Output() readonly reviewCategoryChange = new EventEmitter<TarifarioReviewCategoryChange>();
  @Output() readonly bulkReviewStatus = new EventEmitter<TarifaStatusPico>();
  @Output() readonly ivaChange = new EventEmitter<TarifarioIvaChange>();
  @Output() readonly categoryStateChange = new EventEmitter<TarifarioCategoryStateChange>();
  @Output() readonly nuevoNavigateOut = new EventEmitter<TarifarioNuevoNavigateOut>();


  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentStations'] || changes['rows']) {
      this.currentViewCache.clear();
      this.currentViewStations = null;
      this.currentViewRows = null;
    }
    if (changes['rows'] || changes['drafts'] || changes['draftCategories']) {
      this.visibleRowsSource = null;
    }
  }

  trackCategoria(_index: number, row: TarifarioEditorRow): number {
    return row.categoria;
  }

  get visibleRowList(): TarifarioEditorRow[] {
    return this.syncVisibleRows();
  }

  displayActual(value: number | null): string {
    return formatTarifaImporteDisplay(value);
  }

  displayFecha(iso: string | null | undefined): string {
    return formatFechaActualizacion(iso);
  }

  cellOf(row: TarifarioEditorRow, status: TarifaStatusPico): TarifarioEditorCell {
    return status === 'NO_PICO' ? row.no_pico : row.pico;
  }

  currentView(row: TarifarioEditorRow, status: TarifaStatusPico): TarifarioGroupedCurrent {
    if (this.currentViewStations !== this.currentStations || this.currentViewRows !== this.rows) {
      this.currentViewCache.clear();
      this.currentViewStations = this.currentStations;
      this.currentViewRows = this.rows;
    }
    const key = detectedCellKey(row.categoria, status);
    const cached = this.currentViewCache.get(key);
    if (cached) return cached;
    const view = groupCurrentAmounts(this.currentStations[key] ?? []);
    this.currentViewCache.set(key, view);
    return view;
  }

  trackReview(_index: number, row: TarifarioReviewRow): string {
    return row.candidateId;
  }

  actualImporte(row: TarifarioEditorRow, status: TarifaStatusPico): number | null {
    const view = this.currentView(row, status);
    if (view.kind === 'shared') return view.importe;
    return this.cellOf(row, status).importe;
  }

  isActualMissing(row: TarifarioEditorRow, status: TarifaStatusPico): boolean {
    const view = this.currentView(row, status);
    if (view.kind === 'split') return false;
    return this.actualImporte(row, status) == null;
  }

  detectedFor(categoria: number, status: TarifaStatusPico): TarifarioDetectedAmount[] {
    return this.detected[detectedCellKey(categoria, status)] ?? [];
  }

  formatDetected(item: TarifarioDetectedAmount | TarifarioReviewRow): string {
    return `${formatTarifaImporte(item.valor)} (${item.count})`;
  }

  selectReviewStatus(row: TarifarioReviewRow, status: TarifaStatusPico): void {
    this.reviewStatusChange.emit({ candidateId: row.candidateId, status });
  }

  onReviewCategoryInput(row: TarifarioReviewRow, raw: string): void {
    const trimmed = raw.trim();
    if (!trimmed) {
      this.reviewCategoryChange.emit({ candidateId: row.candidateId, categoria: null });
      return;
    }
    const parsed = Number(trimmed.replace(',', '.'));
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
      this.reviewCategoryChange.emit({ candidateId: row.candidateId, categoria: null });
      return;
    }
    this.reviewCategoryChange.emit({ candidateId: row.candidateId, categoria: parsed });
  }

  reviewCategoryValue(row: TarifarioReviewRow): string {
    return row.categoria == null ? '' : String(row.categoria);
  }

  reviewCategoryInvalid(row: TarifarioReviewRow): boolean {
    return row.requiresCategoriaInput === true && (row.categoria == null || !!row.categoriaError);
  }

  applyAllReviewStatus(status: TarifaStatusPico): void {
    this.bulkReviewStatus.emit(status);
  }

  onIvaInput(candidateId: string | undefined, event: Event): void {
    this.onIvaToggle(candidateId, (event.target as HTMLInputElement).checked);
  }

  onIvaToggle(candidateId: string | undefined, checked: boolean): void {
    if (!candidateId) return;
    this.ivaChange.emit({ candidateId, value: checked });
  }

  isDirty(categoria: number, status: TarifaStatusPico): boolean {
    const draft = this.drafts[categoria];
    if (!draft) return false;
    const raw = status === 'NO_PICO' ? draft.no_pico : draft.pico;
    return raw.trim().length > 0;
  }

  isInvalid(categoria: number, status: TarifaStatusPico): boolean {
    const draft = this.drafts[categoria];
    if (!draft) return false;
    const raw = status === 'NO_PICO' ? draft.no_pico : draft.pico;
    return !isBlankTarifaImporteInput(raw) && parseTarifaImporte(raw) == null;
  }

  draftValue(categoria: number, status: TarifaStatusPico): string {
    const draft = this.drafts[categoria];
    if (!draft) return '';
    return status === 'NO_PICO' ? draft.no_pico : draft.pico;
  }

  setDraft(categoria: number, status: TarifaStatusPico, value: string): void {
    this.draftChange.emit({ categoria, status, value });
  }

  selectCandidate(
    categoria: number,
    status: TarifaStatusPico,
    candidate: TarifarioDetectedAmount,
  ): void {
    if (candidate.readOnly) return;
    this.candidateSelected.emit({ categoria, status, candidate });
  }

  isNuevoFocused(categoria: number, status: TarifaStatusPico): boolean {
    return this.nuevoFocusKey === detectedCellKey(categoria, status);
  }

  selectNuevo(event: FocusEvent): void {
    const el = event.target as HTMLInputElement;
    queueMicrotask(() => el.select());
  }

  onNuevoFocus(event: FocusEvent, categoria: number, status: TarifaStatusPico): void {
    this.nuevoFocusKey = detectedCellKey(categoria, status);
    this.selectNuevo(event);
  }

  onNuevoBlur(categoria: number, status: TarifaStatusPico): void {
    if (this.nuevoFocusKey === detectedCellKey(categoria, status)) {
      this.nuevoFocusKey = null;
    }
  }

  onNuevoKeydown(event: KeyboardEvent): void {
    const inputs = this.enabledNuevoInputs();
    if (!inputs.length) return;
    const current = event.target as HTMLInputElement;
    const index = inputs.indexOf(current);
    if (index < 0) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      this.moveNuevoGrid(event, inputs, index);
      return;
    }
    if (event.key !== 'Tab' && event.key !== 'Enter') return;
    const goingBack = event.key === 'Tab' && event.shiftKey;
    if (goingBack && index === 0) {
      if (this.emitNavigate('prev')) event.preventDefault();
      return;
    }
    const goingForward = !goingBack;
    if (goingForward && index === inputs.length - 1) {
      if (this.emitNavigate('next')) {
        event.preventDefault();
        return;
      }
      if (this.addCategoriaBtn) {
        event.preventDefault();
        this.addCategoriaBtn.nativeElement.focus();
      }
      return;
    }
    event.preventDefault();
    const next = inputs[index + (goingBack ? -1 : 1)];
    next?.focus();
    next?.select();
  }

  onAddKeydown(event: KeyboardEvent): void {
    if ((event.key === 'Tab' && !event.shiftKey) || event.key === 'ArrowDown') {
      if (this.emitNavigate('next')) event.preventDefault();
      return;
    }
    if ((event.key === 'Tab' && event.shiftKey) || event.key === 'ArrowUp') {
      const last = this.enabledNuevoInputs().at(-1);
      if (!last) return;
      event.preventDefault();
      last.focus();
      last.select();
    }
  }

  onBoardKeydown(event: KeyboardEvent): void {
    if (event.key !== '+' && event.key !== 'Add') return;
    if ((event.target as HTMLElement | null)?.classList.contains('tf__input')) return;
    if (!this.allowAddCategoria) return;
    event.preventDefault();
    this.addCategoria.emit();
  }

  private enabledNuevoInputs(): HTMLInputElement[] {
    return (this.nuevoInputs?.map((ref) => ref.nativeElement) ?? []).filter((input) => !input.disabled);
  }

  private emitNavigate(direction: 'next' | 'prev'): boolean {
    const nav: TarifarioNuevoNavigateOut = { direction, consumed: false };
    this.nuevoNavigateOut.emit(nav);
    return nav.consumed;
  }

  private moveNuevoGrid(event: KeyboardEvent, inputs: HTMLInputElement[], index: number): void {
    const cols = this.lanes.length;
    let target = index;
    let outbound: 'next' | 'prev' | null = null;
    if (event.key === 'ArrowRight') {
      if (index + 1 < inputs.length) target = index + 1;
      else outbound = 'next';
    } else if (event.key === 'ArrowLeft') {
      if (index > 0) target = index - 1;
      else outbound = 'prev';
    } else if (event.key === 'ArrowDown') {
      if (index + cols < inputs.length) target = index + cols;
      else outbound = 'next';
    } else if (event.key === 'ArrowUp') {
      if (index - cols >= 0) target = index - cols;
      else outbound = 'prev';
    }
    if (outbound) {
      if (this.emitNavigate(outbound)) event.preventDefault();
      return;
    }
    if (target === index) return;
    event.preventDefault();
    inputs[target].focus();
    inputs[target].select();
  }

  requestHistory(row: TarifarioEditorRow, status: TarifaStatusPico): void {
    this.historyRequest.emit({ row, status });
  }

  emitAddCategoria(): void {
    if (!this.allowAddCategoria) return;
    this.addCategoria.emit();
  }

  isEnabled(row: TarifarioEditorRow, status: TarifaStatusPico): boolean {
    return this.cellOf(row, status).enabled !== false;
  }

  categoryState(row: TarifarioEditorRow) {
    return categoryStateForIdentities([
      { categoria: row.categoria, enabled: this.isEnabled(row, 'NO_PICO'), tarifaId: row.no_pico.tarifa_id },
      { categoria: row.categoria, enabled: this.isEnabled(row, 'PICO'), tarifaId: row.pico.tarifa_id },
    ], row.categoria);
  }

  categoryActionLabel(row: TarifarioEditorRow): string {
    return this.categoryState(row).enabled ? 'Deshabilitar' : 'Habilitar';
  }

  categoryActionTitle(row: TarifarioEditorRow): string {
    return `${this.categoryActionLabel(row)} categoría ${row.categoria}`;
  }

  toggleCategoryState(row: TarifarioEditorRow): void {
    const state = this.categoryState(row);
    if (!state.hasExisting) return;
    this.categoryStateChange.emit({
      categoria: row.categoria,
      enabled: !state.enabled,
      tarifaIds: state.tarifaIds,
    });
  }

  lastPersistedCategoryIndex(): number {
    const rows = this.visibleRowList;
    let last = -1;
    rows.forEach((row, index) => {
      if (row.no_pico.tarifa_id || row.pico.tarifa_id) last = index;
    });
    return last >= 0 ? last : rows.length - 1;
  }

  shouldRenderAddRow(index: number): boolean {
    return this.showAddCategoria && index === this.lastPersistedCategoryIndex();
  }

  addCategoryLabel(): string {
    if (!this.nextCategoria) return 'Agregar categoría';
    return this.nextCategoryAction === 'ENABLE'
      ? `Habilitar categoría ${this.nextCategoria}`
      : `Agregar categoría ${this.nextCategoria}`;
  }

  addCategoryHint(): string {
    if (!this.allowAddCategoria) return 'Ya están las 10 categorías.';
    return this.nextCategoryAction === 'ENABLE'
      ? 'La categoría existe deshabilitada y se habilitarán PICO y NO_PICO.'
      : 'Tab o + · Enter. Máximo 10 categorías.';
  }

  /**
   * Backend rows may include historical disabled identities and a materialized
   * category range. Keep those records in memory for matching/re-enable, but
   * only render active identities or categories explicitly opened by Add.
   */
  visibleRows(): TarifarioEditorRow[] {
    return this.syncVisibleRows();
  }

  private syncVisibleRows(): TarifarioEditorRow[] {
    if (
      this.visibleRowsSource?.rows === this.rows &&
      this.visibleRowsSource?.drafts === this.drafts &&
      this.visibleRowsSource?.draftCategories === this.draftCategories
    ) {
      return this.cachedVisibleRows;
    }
    this.visibleRowsSource = {
      rows: this.rows,
      drafts: this.drafts,
      draftCategories: this.draftCategories,
    };
    this.cachedVisibleRows = this.computeVisibleRows();
    return this.cachedVisibleRows;
  }

  private computeVisibleRows(): TarifarioEditorRow[] {
    const highestVisibleCategory = this.rows.reduce((max, row) => {
      const hasEnabledIdentity = [row.no_pico, row.pico].some(
        (cell) => !!cell.tarifa_id && cell.enabled !== false,
      );
      const explicitlyOpened = this.draftCategories.includes(row.categoria);
      return hasEnabledIdentity || explicitlyOpened
        ? Math.max(max, row.categoria)
        : max;
    }, 0);

    return this.rows.filter((row) => {
      if (row.categoria > highestVisibleCategory) return false;
      const hasExistingIdentity = !!row.no_pico.tarifa_id || !!row.pico.tarifa_id;
      const hasEnabledIdentity = [row.no_pico, row.pico].some(
        (cell) => !!cell.tarifa_id && cell.enabled !== false,
      );
      const explicitlyOpened = this.draftCategories.includes(row.categoria);

      // Keep unconfigured rows inside the leading category range so the
      // board remains 1, 2, 3…; trim only trailing materialized blanks.
      // Disabled identities stay hidden until Agregar / Habilitar.
      return !hasExistingIdentity || hasEnabledIdentity || explicitlyOpened;
    });
  }
}
