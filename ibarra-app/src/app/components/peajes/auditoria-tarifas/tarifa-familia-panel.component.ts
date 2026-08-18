import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DataTableColumn,
  DataTableColumnDirective,
  DataTableComponent,
  DataTableSort,
} from '../../shared';
import {
  TarifaAsignacion,
  TarifaDiagnostico,
  TarifaNormalizadaRow,
  TarifaStatusCatalogo,
} from './contracts.local';
import {
  DIAGNOSTICO_BADGE_CLASS,
  DIAGNOSTICO_LABELS,
  PicoNoPicoPair,
  detectPicoNoPicoPair,
  familiaFromNiveles,
  isPicoNoPicoSelection,
  pairAlreadyConfirmed,
  parseCategoriaCalculated,
  patronFromRow,
  suggestStatusByPrice,
} from './auditoria-tarifas.helpers';
import { TarifaStatusButtonsComponent } from './tarifa-status-buttons.component';

@Component({
  selector: 'app-tarifa-familia-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, DataTableColumnDirective, TarifaStatusButtonsComponent],
  templateUrl: './tarifa-familia-panel.component.html',
  styleUrl: './tarifa-familia-panel.component.css',
})
export class TarifaFamiliaPanelComponent implements OnChanges, OnInit {
  @Input() niveles: TarifaNormalizadaRow[] = [];
  @Input() catalogo: TarifaStatusCatalogo[] = [];
  @Input() saving = false;
  @Input() confirmError: string | null = null;
  @Input() focusPending = false;

  @Output() confirm = new EventEmitter<TarifaAsignacion[]>();
  @Output() confirmNext = new EventEmitter<TarifaAsignacion[]>();
  @Output() marcarDiagnostico = new EventEmitter<TarifaDiagnostico>();
  @Output() comparar = new EventEmitter<void>();
  @Output() verCasos = new EventEmitter<TarifaNormalizadaRow>();

  selections = new Map<string, string>();
  clases = new Map<string, number | null>();
  suggestionPristine = true;
  private readonly touchedIds = new Set<string>();
  detailSort: DataTableSort = { key: 'importe', direction: 'asc' };
  detailPage = 1;
  detailPageSize = 10;
  readonly detailPageSizes = [10, 25, 50];

  readonly detailColumns: DataTableColumn[] = [
    { key: 'importe', label: 'Importe', sortable: true, align: 'right', width: '8rem' },
    { key: 'cases', label: 'Casos', sortable: true, align: 'right', width: '5rem' },
    { key: 'multiplicador', label: 'Mult.', sortable: false, width: '10rem', templateOnly: true },
    { key: 'franja', label: 'Franja horaria', sortable: false, width: '16rem', templateOnly: true },
    { key: 'diagnostico', label: 'Diagnóstico', sortable: false, width: '9rem', templateOnly: true },
    { key: 'categoria_calculated', label: 'Categoría', sortable: false, width: '5.5rem', templateOnly: true },
    { key: 'status', label: 'Clasificación', sortable: false, templateOnly: true },
    { key: 'acciones', label: 'Acciones', sortable: false, templateOnly: true, align: 'right', width: '8.5rem' },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    const nivelesChanged = !!changes['niveles'];
    const catalogoChanged = !!changes['catalogo'];
    if (!nivelesChanged && !catalogoChanged) return;
    if (catalogoChanged && !nivelesChanged && !this.suggestionPristine) return;
    this.applySuggestion();
  }

  ngOnInit(): void {
    this.applySuggestion();
  }

  get meta() {
    return familiaFromNiveles(this.niveles);
  }

  get sortedNiveles(): TarifaNormalizadaRow[] {
    const rows = [...this.niveles];
    const dir = this.detailSort.direction === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[this.detailSort.key];
      const bv = (b as unknown as Record<string, unknown>)[this.detailSort.key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'es') * dir;
    });
    return rows;
  }

  get pagedNiveles(): TarifaNormalizadaRow[] {
    const from = (this.detailPage - 1) * this.detailPageSize;
    return this.sortedNiveles.slice(from, from + this.detailPageSize);
  }

  get detailTableRows(): Record<string, unknown>[] {
    return this.pagedNiveles as unknown as Record<string, unknown>[];
  }

  get detailTotalPages(): number {
    return Math.max(1, Math.ceil(this.niveles.length / this.detailPageSize));
  }

  get detailRangeLabel(): string {
    if (!this.niveles.length) return '0–0 de 0';
    const from = (this.detailPage - 1) * this.detailPageSize + 1;
    const to = Math.min(this.detailPage * this.detailPageSize, this.niveles.length);
    return `${from}–${to} de ${this.niveles.length}`;
  }

  get maxMultiplicador(): number {
    return Math.max(...this.niveles.map((n) => n.multiplicador), 1);
  }

  get unconfirmedCount(): number {
    return this.niveles.filter((n) => {
      const sel = this.selections.get(n.id);
      return !sel || sel === 'PENDIENTE';
    }).length;
  }

  get confirmLabel(): string {
    const n = this.niveles.length - this.unconfirmedCount;
    return this.saving ? 'Guardando…' : n ? `Confirmar ${n} niveles` : 'Sin cambios';
  }

  get suggestionNote(): string {
    return this.suggestionPristine
      ? 'Propuesta automática por precio. Ajustá lo que no corresponda y confirmá.'
      : 'Editado manualmente.';
  }

  get picoNoPicoPair(): PicoNoPicoPair | null {
    return detectPicoNoPicoPair(this.niveles, this.catalogo);
  }

  get showReconocimiento(): boolean {
    const pair = this.picoNoPicoPair;
    return !!pair && !pairAlreadyConfirmed(pair);
  }

  get reconocimientoHint(): string {
    const pair = this.picoNoPicoPair;
    if (!pair) return '';
    return `El más bajo es ${pair.noPicoLabel} y el más alto es ${pair.picoLabel}. Confirmalo para dejar el diagnóstico en Confirmado.`;
  }

  asNivel(row: Record<string, unknown>): TarifaNormalizadaRow {
    return row as unknown as TarifaNormalizadaRow;
  }

  isPatronA(nivel: TarifaNormalizadaRow): boolean {
    return patronFromRow(nivel) === 'A';
  }

  claseValue(nivelId: string): number | null {
    return this.clases.has(nivelId) ? (this.clases.get(nivelId) ?? null) : null;
  }

  onClase(nivelId: string, raw: unknown): void {
    this.clases.set(nivelId, parseCategoriaCalculated(raw));
    this.suggestionPristine = false;
  }

  diagnosticoLabel(d: TarifaDiagnostico): string {
    return DIAGNOSTICO_LABELS[d];
  }

  diagnosticoClass(d: TarifaDiagnostico): string {
    return `at__badge ${DIAGNOSTICO_BADGE_CLASS[d]}`;
  }

  barWidth(mult: number): string {
    return `${Math.min(100, (mult / this.maxMultiplicador) * 100)}%`;
  }

  railStyle(nivel: TarifaNormalizadaRow): { left: string; width: string } {
    const min = nivel.hora_min ?? 0;
    const max = nivel.hora_max ?? 23;
    return {
      left: `${Math.min(100, Math.max(0, (min / 24) * 100))}%`,
      width: `${Math.max(((Math.max(min, max) - min) / 24) * 100, 2)}%`,
    };
  }

  /** Primer y último caso del nivel (UTC). Media es opcional para el riel. */
  hasHours(nivel: TarifaNormalizadaRow): boolean {
    return nivel.hora_min != null && nivel.hora_max != null;
  }

  formatHour(value: number | null): string {
    if (value == null || !Number.isFinite(value)) return '—';
    const totalMinutes = Math.round(value * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = Math.abs(totalMinutes % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  /** Vista principal: primer caso – último caso, p. ej. `03:00 – 05:00`. */
  franjaLabel(nivel: TarifaNormalizadaRow): string {
    if (!this.hasHours(nivel)) return 'Sin datos horarios';
    return `${this.formatHour(nivel.hora_min)} – ${this.formatHour(nivel.hora_max)}`;
  }

  hourPercent(value: number | null): number {
    return value == null ? 0 : Math.min(100, Math.max(0, (value / 24) * 100));
  }

  shouldFocus(nivel: TarifaNormalizadaRow): boolean {
    if (!this.focusPending || (nivel.status !== 'PENDIENTE' && nivel.status !== 'POSIBLE_HORARIO')) return false;
    return this.niveles.find((item) => item.status === 'PENDIENTE' || item.status === 'POSIBLE_HORARIO')?.id === nivel.id;
  }

  mediaLabel(nivel: TarifaNormalizadaRow): string {
    if (!this.hasHours(nivel)) return 'Sin datos horarios';
    const parts: string[] = [];
    if (nivel.hora_media != null) {
      parts.push(`Media ${this.formatHour(nivel.hora_media)}`);
    }
    if (nivel.desvio != null) {
      parts.push(`desvío ${nivel.desvio.toFixed(2)} h`);
    }
    return parts.length ? parts.join(' · ') : 'Primer–último caso (UTC)';
  }

  onSelect(nivelId: string, codigo: string): void {
    this.selections.set(nivelId, codigo);
    this.suggestionPristine = false;
    this.touchedIds.add(nivelId);
    if (this.shouldAutoConfirmPicoNoPico()) this.onConfirm();
  }

  onReconocimientoDetectado(): void {
    const pair = this.picoNoPicoPair;
    if (!pair || this.saving) return;
    this.selections.set(pair.low.id, pair.noPicoCode);
    this.selections.set(pair.high.id, pair.picoCode);
    this.suggestionPristine = false;
    this.confirm.emit(this.buildAsignaciones());
  }

  onVerCasos(nivel: TarifaNormalizadaRow): void {
    this.verCasos.emit(nivel);
  }

  onConfirm(): void {
    const asignaciones = this.buildAsignaciones();
    if (asignaciones.length) this.confirm.emit(asignaciones);
  }

  onConfirmNext(): void {
    const asignaciones = this.buildAsignaciones();
    if (asignaciones.length) this.confirmNext.emit(asignaciones);
  }

  buildAsignaciones(): TarifaAsignacion[] {
    return this.niveles.flatMap((nivel) => {
      const code = this.selections.get(nivel.id);
      if (!code || code === 'PENDIENTE') return [];
      const item: TarifaAsignacion = {
        tarifa_normalizada_id: nivel.id,
        status_codigo: code,
      };
      const cat = this.clases.get(nivel.id);
      if (cat != null) item.categoria_calculated = cat;
      return [item];
    });
  }

  onDetailSort(sort: DataTableSort): void {
    this.detailSort = sort;
    this.detailPage = 1;
  }

  onDetailPageSize(size: number): void {
    this.detailPageSize = size;
    this.detailPage = 1;
  }

  goDetailPage(page: number): void {
    this.detailPage = Math.min(Math.max(1, page), this.detailTotalPages);
  }

  private applySuggestion(): void {
    const suggested = suggestStatusByPrice(this.niveles, this.catalogo);
    const ids = new Set(this.niveles.map((n) => n.id));
    const nextSelections = new Map<string, string>();
    const nextClases = new Map<string, number | null>();

    for (const nivel of this.niveles) {
      const saved = this.classifiedStatus(nivel.status);
      const code = saved ?? suggested.get(nivel.id);
      if (code) nextSelections.set(nivel.id, code);
      nextClases.set(nivel.id, nivel.categoria_calculated ?? null);
    }

    if (!this.suggestionPristine) {
      for (const [id, code] of this.selections) {
        if (ids.has(id)) nextSelections.set(id, code);
      }
      for (const [id, cat] of this.clases) {
        if (ids.has(id)) nextClases.set(id, cat);
      }
    } else {
      this.touchedIds.clear();
    }

    this.selections = nextSelections;
    this.clases = nextClases;
    this.detailPage = Math.min(this.detailPage, this.detailTotalPages);
  }

  private classifiedStatus(status: string | null | undefined): string | null {
    if (!status || status === 'PENDIENTE') return null;
    return status;
  }

  private shouldAutoConfirmPicoNoPico(): boolean {
    if (this.saving) return false;
    const pair = this.picoNoPicoPair;
    if (!pair || this.touchedIds.size < 2) return false;
    return isPicoNoPicoSelection(pair, this.selections);
  }
}
