import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogComponent } from '../../shared';
import {
  TarifaAsignacion,
  TarifaFamilia,
  TarifaGrupoSimilar,
  TarifaNormalizadaRow,
  TarifaStatusCatalogo,
} from './contracts.local';
import { TarifaStatusBadgeComponent } from './tarifa-status-badge.component';

@Component({
  selector: 'app-tarifa-comparar-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogComponent, TarifaStatusBadgeComponent],
  templateUrl: './tarifa-comparar-dialog.component.html',
  styleUrl: './tarifa-comparar-dialog.component.css',
})
export class TarifaCompararDialogComponent implements OnChanges, AfterViewChecked {
  @Input() open = false;
  @Input() familia: TarifaFamilia | null = null;
  @Input() similares: TarifaGrupoSimilar[] = [];
  @Input() loading = false;
  @Input() saving = false;
  @Input() error: string | null = null;
  @Input() tolerancia = 0.05;
  @Input() catalogo: TarifaStatusCatalogo[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() toleranciaChange = new EventEmitter<number>();
  @Output() aplicarMasivo = new EventEmitter<TarifaAsignacion[]>();

  @ViewChild('firstFocus') firstFocus?: ElementRef<HTMLElement>;
  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  selectedIds = new Set<string>();
  private triggerElement: HTMLElement | null = null;
  private focusApplied = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.triggerElement = document.activeElement as HTMLElement | null;
      this.focusApplied = false;
    }
    if (changes['similares']) {
      this.selectedIds = new Set();
      this.similares.forEach((g) => {
        if (g.niveles === (this.familia?.niveles.length ?? 0)) {
          this.selectedIds.add(g.estacion_id);
        }
      });
    }
  }

  ngAfterViewChecked(): void {
    if (this.open && !this.focusApplied) {
      this.firstFocus?.nativeElement?.focus();
      this.focusApplied = true;
    }
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get applyLabel(): string {
    return this.saving
      ? 'Aplicando…'
      : `Aplicar a ${this.selectedCount} estacion${this.selectedCount === 1 ? '' : 'es'}`;
  }

  sortedFamilia(): TarifaNormalizadaRow[] {
    return [...(this.familia?.niveles ?? [])].sort((a, b) => a.importe - b.importe);
  }

  onClose(): void {
    this.open = false;
    this.closed.emit();
    if (this.triggerElement) {
      this.triggerElement.focus();
      this.triggerElement = null;
    }
  }

  onTolerancia(value: number): void {
    this.toleranciaChange.emit(value);
  }

  toggleSimilar(estacionId: string): void {
    if (this.selectedIds.has(estacionId)) {
      this.selectedIds.delete(estacionId);
    } else {
      this.selectedIds.add(estacionId);
    }
  }

  isDifferentLevels(grupo: TarifaGrupoSimilar): boolean {
    return grupo.niveles !== (this.familia?.niveles.length ?? 0);
  }

  onApply(): void {
    if (!this.familia) return;
    const sourceSorted = this.sortedFamilia();
    const sourceAssignments = sourceSorted.map((n) => ({
      tarifa_normalizada_id: n.id,
      status_codigo: n.status,
    }));

    const all: TarifaAsignacion[] = [...sourceAssignments];

    this.similares
      .filter((g) => this.selectedIds.has(g.estacion_id))
      .forEach((grupo) => {
        const targetIds = grupo.tarifa_ids ?? [];
        const pairCount = Math.min(targetIds.length, sourceSorted.length);
        for (let i = 0; i < pairCount; i++) {
          all.push({
            tarifa_normalizada_id: targetIds[i],
            status_codigo: sourceSorted[i].status,
          });
        }
      });

    this.aplicarMasivo.emit(all);
  }

  onPanelKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.panel) return;
    const focusable = this.panel.nativeElement.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
