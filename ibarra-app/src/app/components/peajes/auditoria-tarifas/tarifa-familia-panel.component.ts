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
  familiaFromNiveles,
  suggestStatusByPrice,
} from './auditoria-tarifas.helpers';
import { TarifaStatusButtonsComponent } from './tarifa-status-buttons.component';

@Component({
  selector: 'app-tarifa-familia-panel',
  standalone: true,
  imports: [
    CommonModule,
    DataTableComponent,
    DataTableColumnDirective,
    TarifaStatusButtonsComponent,
  ],
  templateUrl: './tarifa-familia-panel.component.html',
  styleUrl: './tarifa-familia-panel.component.css',
})
export class TarifaFamiliaPanelComponent implements OnChanges, OnInit {
  @Input() niveles: TarifaNormalizadaRow[] = [];
  @Input() catalogo: TarifaStatusCatalogo[] = [];
  @Input() saving = false;
  @Input() confirmError: string | null = null;

  @Output() confirm = new EventEmitter<TarifaAsignacion[]>();
  @Output() marcarDiagnostico = new EventEmitter<TarifaDiagnostico>();
  @Output() comparar = new EventEmitter<void>();

  selections = new Map<string, string>();
  suggestionPristine = true;
  detailSort: DataTableSort = { key: 'importe', direction: 'asc' };

  readonly detailColumns: DataTableColumn[] = [
    { key: 'importe', label: 'Importe', sortable: true, align: 'right', width: '8rem' },
    { key: 'cases', label: 'Casos', sortable: true, align: 'right', width: '5rem' },
    { key: 'multiplicador', label: 'Mult.', sortable: false, width: '10rem' },
    { key: 'franja', label: 'Franja horaria', sortable: false, width: '14rem' },
    { key: 'diagnostico', label: 'Diagnóstico', sortable: false, width: '9rem' },
    { key: 'status', label: 'Clasificación', sortable: false },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['niveles'] || changes['catalogo']) {
      this.applySuggestion();
    }
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
      return String(av).localeCompare(String(bv)) * dir;
    });
    return rows;
  }

  get detailTableRows(): Record<string, unknown>[] {
    return this.sortedNiveles as unknown as Record<string, unknown>[];
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
    return this.saving ? 'Confirmando…' : `Confirmar ${n} niveles`;
  }

  get suggestionNote(): string {
    return this.suggestionPristine
      ? 'Propuesta automática por precio. Ajustá lo que no corresponda y confirmá.'
      : 'Editado.';
  }

  diagnosticoLabel(d: TarifaDiagnostico): string {
    return DIAGNOSTICO_LABELS[d];
  }

  diagnosticoClass(d: TarifaDiagnostico): string {
    return `at__badge ${DIAGNOSTICO_BADGE_CLASS[d]}`;
  }

  barWidth(mult: number): string {
    const pct = Math.min(100, (mult / this.maxMultiplicador) * 100);
    return `${pct}%`;
  }

  railStyle(nivel: TarifaNormalizadaRow): { left: string; width: string } {
    const min = nivel.hora_min ?? 0;
    const max = nivel.hora_max ?? 23;
    const left = (min / 24) * 100;
    const width = Math.max(((max - min + 1) / 24) * 100, 2);
    return { left: `${left}%`, width: `${width}%` };
  }

  mediaLabel(nivel: TarifaNormalizadaRow): string {
    const media = nivel.hora_media != null ? `${nivel.hora_media} h` : '—';
    const desvio = nivel.desvio != null ? nivel.desvio.toFixed(2) : '—';
    return `media ${media} · desvío ${desvio}`;
  }

  onSelect(nivelId: string, codigo: string): void {
    this.selections.set(nivelId, codigo);
    this.suggestionPristine = false;
  }

  onConfirm(): void {
    const asignaciones = this.buildAsignaciones();
    if (!asignaciones.length) return;
    this.confirm.emit(asignaciones);
  }

  buildAsignaciones(): TarifaAsignacion[] {
    const result: TarifaAsignacion[] = [];
    this.niveles.forEach((n) => {
      const code = this.selections.get(n.id);
      if (code && code !== 'PENDIENTE') {
        result.push({ tarifa_normalizada_id: n.id, status_codigo: code });
      }
    });
    return result;
  }

  onDetailSort(sort: DataTableSort): void {
    this.detailSort = sort;
  }

  private applySuggestion(): void {
    this.selections = suggestStatusByPrice(this.niveles, this.catalogo);
    this.suggestionPristine = true;
  }
}
