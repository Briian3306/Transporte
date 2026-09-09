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
  TarifaStatusPico,
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
}

export type TarifarioDetectedMap = Record<string, TarifarioDetectedAmount[]>;

export interface TarifarioDraftChange {
  categoria: number;
  status: TarifaStatusPico;
  value: string;
}

export interface TarifarioHistoryRequest {
  row: TarifarioEditorRow;
  status: TarifaStatusPico;
}

export function detectedCellKey(categoria: number, status: TarifaStatusPico): string {
  return `${categoria}:${status}`;
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

  @Input() rows: TarifarioEditorRow[] = [];
  @Input() drafts: TarifarioEditorDrafts = {};
  @Input() detected: TarifarioDetectedMap = {};
  @Input() allowAddCategoria = true;
  @Input() categoriaCount = 0;
  @Input() showAddCategoria = true;

  @Output() readonly draftChange = new EventEmitter<TarifarioDraftChange>();
  @Output() readonly historyRequest = new EventEmitter<TarifarioHistoryRequest>();
  @Output() readonly addCategoria = new EventEmitter<void>();

  displayActual(value: number | null): string {
    return formatTarifaImporteDisplay(value);
  }

  displayFecha(iso: string | null | undefined): string {
    return formatFechaActualizacion(iso);
  }

  detectedFor(categoria: number, status: TarifaStatusPico): TarifarioDetectedAmount[] {
    return this.detected[detectedCellKey(categoria, status)] ?? [];
  }

  formatDetected(valor: number): string {
    return formatTarifaImporte(valor);
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

  selectNuevo(event: FocusEvent): void {
    const el = event.target as HTMLInputElement;
    queueMicrotask(() => el.select());
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
