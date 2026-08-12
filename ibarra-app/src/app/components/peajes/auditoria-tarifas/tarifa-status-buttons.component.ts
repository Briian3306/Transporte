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
import { TarifaStatusCatalogo } from './contracts.local';
import { buildStatusCatalogoButtons } from './auditoria-tarifas.helpers';

@Component({
  selector: 'app-tarifa-status-buttons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tarifa-status-buttons.component.html',
  styleUrl: './tarifa-status-buttons.component.css',
})
export class TarifaStatusButtonsComponent implements OnChanges, OnInit {
  @Input() importe = 0;
  @Input() catalogo: TarifaStatusCatalogo[] = [];
  @Input() selected: string | null = null;
  @Input() disabled = false;

  @Output() selectedChange = new EventEmitter<string>();

  buttons: TarifaStatusCatalogo[] = [];
  focusIndex = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['catalogo'] || changes['selected']) {
      this.rebuildButtons();
    }
  }

  ngOnInit(): void {
    this.rebuildButtons();
  }

  private rebuildButtons(): void {
    this.buttons = buildStatusCatalogoButtons(this.catalogo);
    if (!this.buttons.some((c) => c.codigo === 'POSIBLE_HORARIO')) {
      this.buttons = [
        ...this.buttons,
        {
          peaje_id: this.catalogo[0]?.peaje_id ?? '',
          codigo: 'POSIBLE_HORARIO',
          etiqueta: 'Posible horario',
          color: '#2563eb',
          tipo_meta: 'NEUTRO',
          orden: 999,
        },
      ];
    }
    this.syncFocusIndex();
  }

  get hasSelection(): boolean {
    return !!this.selected && this.selected !== 'PENDIENTE';
  }

  isSelected(codigo: string): boolean {
    return this.selected === codigo;
  }

  select(codigo: string): void {
    if (this.disabled) return;
    this.selectedChange.emit(codigo);
    this.focusIndex = this.buttons.findIndex((b) => b.codigo === codigo);
  }

  onKeydown(event: KeyboardEvent, index: number): void {
    if (this.disabled || !this.buttons.length) return;

    let next = index;
    if (event.key === 'ArrowRight') {
      next = (index + 1) % this.buttons.length;
      event.preventDefault();
    } else if (event.key === 'ArrowLeft') {
      next = (index - 1 + this.buttons.length) % this.buttons.length;
      event.preventDefault();
    } else if (event.key === 'Home') {
      next = 0;
      event.preventDefault();
    } else if (event.key === 'End') {
      next = this.buttons.length - 1;
      event.preventDefault();
    } else {
      return;
    }

    this.focusIndex = next;
    this.select(this.buttons[next].codigo);
    this.focusButton(next);
  }

  tabIndexFor(index: number): number {
    if (!this.hasSelection) {
      return index === 0 ? 0 : -1;
    }
    const selectedIndex = this.buttons.findIndex((b) => b.codigo === this.selected);
    return index === (selectedIndex >= 0 ? selectedIndex : this.focusIndex) ? 0 : -1;
  }

  private syncFocusIndex(): void {
    if (this.selected) {
      const idx = this.buttons.findIndex((b) => b.codigo === this.selected);
      if (idx >= 0) this.focusIndex = idx;
    }
  }

  private focusButton(index: number): void {
    setTimeout(() => {
      const el = document.getElementById(this.buttonId(index));
      el?.focus();
    });
  }

  buttonId(index: number): string {
    return `status-btn-${this.importe}-${index}`;
  }
}
