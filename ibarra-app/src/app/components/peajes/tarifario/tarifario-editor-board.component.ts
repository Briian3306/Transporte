import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  QueryList,
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
  collectDraftErrores,
  formatFechaActualizacion,
  formatTarifaImporte,
  formatTarifaImporteDisplay,
} from './tarifario.helpers';

export interface TarifarioDetectedAmount {
  valor: number;
  count: number;
  estacionId?: string;
  estacionNombre?: string;
  color?: string;
  candidateId?: string;
  showIva?: boolean;
  ivaChecked?: boolean;
}

export interface TarifarioReviewRow {
  candidateId: string;
  valor: number;
  count: number;
  categoria: number | null;
  status: TarifaStatusPico | null;
  sentido: TarifaSentido | null;
  estacionId?: string;
  estacionNombre?: string;
  color?: string;
  showIva?: boolean;
  ivaChecked?: boolean;
}

export interface TarifarioReviewIdentityChange {
  candidateId: string;
  status: TarifaStatusPico | null;
  sentido: TarifaSentido | null;
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
export class TarifarioEditorBoardComponent {
  @ViewChildren('nuevoInput') private readonly nuevoInputs?: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChild('addCategoriaBtn') private readonly addCategoriaBtn?: ElementRef<HTMLButtonElement>;

  readonly missing = MISSING_IMPORTE_LABEL;
  readonly categoriasMax = TARIFARIO_CATEGORIAS_MAX;
  readonly lanes: ReadonlyArray<{ status: TarifaStatusPico; lane: 'nopico' | 'pico' }> = [
    { status: 'NO_PICO', lane: 'nopico' },
    { status: 'PICO', lane: 'pico' },
  ];
  private nuevoFocusKey: string | null = null;

  @Input() rows: TarifarioEditorRow[] = [];
  @Input() drafts: TarifarioEditorDrafts = {};
  @Input() detected: TarifarioDetectedMap = {};
  @Input() currentStations: TarifarioCurrentStationMap = {};
  @Input() reviewRows: TarifarioReviewRow[] = [];
  @Input() allowAddCategoria = true;
  @Input() categoriaCount = 0;
  @Input() showAddCategoria = true;

  @Output() readonly draftChange = new EventEmitter<TarifarioDraftChange>();
  @Output() readonly candidateSelected = new EventEmitter<TarifarioCandidateSelected>();
  @Output() readonly historyRequest = new EventEmitter<TarifarioHistoryRequest>();
  @Output() readonly addCategoria = new EventEmitter<void>();
  @Output() readonly reviewIdentityChange = new EventEmitter<TarifarioReviewIdentityChange>();
  @Output() readonly ivaChange = new EventEmitter<TarifarioIvaChange>();

  readonly statusOptions: ReadonlyArray<TarifaStatusPico> = ['NO_PICO', 'PICO'];
  readonly sentidoOptions: ReadonlyArray<TarifaSentido> = ['IDA', 'VUELTA', 'AMBAS'];

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
    return groupCurrentAmounts(this.currentStations[detectedCellKey(row.categoria, status)] ?? []);
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

  onReviewStatus(row: TarifarioReviewRow, raw: string): void {
    const status = raw === 'PICO' || raw === 'NO_PICO' ? raw : null;
    this.reviewIdentityChange.emit({ candidateId: row.candidateId, status, sentido: row.sentido });
  }

  onReviewSentido(row: TarifarioReviewRow, raw: string): void {
    const sentido = raw === 'IDA' || raw === 'VUELTA' || raw === 'AMBAS' ? raw : null;
    this.reviewIdentityChange.emit({ candidateId: row.candidateId, status: row.status, sentido });
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
    return collectDraftErrores(this.rows, this.drafts).some(
      (error) => error.categoria === categoria && error.status === status,
    );
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
    if (event.key !== 'Tab' && event.key !== 'Enter') return;
    const inputs = this.nuevoInputs?.map((ref) => ref.nativeElement) ?? [];
    if (!inputs.length) return;
    const current = event.target as HTMLInputElement;
    const index = inputs.indexOf(current);
    if (index < 0) return;
    if (event.key === 'Tab' && event.shiftKey && index === 0) return;
    const goingForward = !event.shiftKey;
    if (goingForward && index === inputs.length - 1) {
      event.preventDefault();
      this.addCategoriaBtn?.nativeElement.focus();
      return;
    }
    event.preventDefault();
    const delta = event.shiftKey ? -1 : 1;
    const next = inputs[(index + delta + inputs.length) % inputs.length];
    next.focus();
    next.select();
  }

  onBoardKeydown(event: KeyboardEvent): void {
    if (event.key !== '+' && event.key !== 'Add') return;
    if ((event.target as HTMLElement | null)?.classList.contains('tf__input')) return;
    if (!this.allowAddCategoria) return;
    event.preventDefault();
    this.addCategoria.emit();
  }

  requestHistory(row: TarifarioEditorRow, status: TarifaStatusPico): void {
    this.historyRequest.emit({ row, status });
  }

  emitAddCategoria(): void {
    if (!this.allowAddCategoria) return;
    this.addCategoria.emit();
  }
}
