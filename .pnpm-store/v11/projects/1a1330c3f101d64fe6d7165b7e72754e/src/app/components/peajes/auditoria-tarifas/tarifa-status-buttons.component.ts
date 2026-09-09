import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchSelectComponent, SearchSelectOption } from '../../shared';
import { TarifaStatusCatalogo } from './contracts.local';
import { buildStatusCatalogoButtons } from './auditoria-tarifas.helpers';

@Component({
  selector: 'app-tarifa-status-buttons',
  standalone: true,
  imports: [CommonModule, SearchSelectComponent],
  templateUrl: './tarifa-status-buttons.component.html',
  styleUrl: './tarifa-status-buttons.component.css',
})
export class TarifaStatusButtonsComponent implements OnChanges, OnInit, AfterViewInit {
  @Input() importe = 0;
  @Input() catalogo: TarifaStatusCatalogo[] = [];
  @Input() selected: string | null = null;
  @Input() disabled = false;
  @Input() autoFocus = false;

  @Output() selectedChange = new EventEmitter<string>();

  @ViewChild(SearchSelectComponent) private searchSelect?: SearchSelectComponent;

  options: SearchSelectOption[] = [];
  private buttons: TarifaStatusCatalogo[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['catalogo']) {
      this.rebuildOptions();
    }
  }

  ngOnInit(): void {
    this.rebuildOptions();
  }

  ngAfterViewInit(): void {
    if (this.autoFocus && !this.disabled) {
      setTimeout(() => this.searchSelect?.focusInput());
    }
  }

  get selectValue(): string | null {
    if (!this.selected || this.selected === 'PENDIENTE') return null;
    return this.selected;
  }

  get hasSelection(): boolean {
    return !!this.selectValue;
  }

  get currentColor(): string {
    const code = this.selectValue;
    if (!code) return '#B45309';
    return this.buttons.find((b) => b.codigo === code)?.color ?? '#004ac6';
  }

  get currentLabel(): string {
    const code = this.selectValue;
    if (!code) return 'Sin clasificar';
    return this.buttons.find((b) => b.codigo === code)?.etiqueta ?? code;
  }

  get ariaLabel(): string {
    return `Clasificación de ${this.importe.toFixed(2)}: ${this.currentLabel}`;
  }

  onValueChange(value: string | null): void {
    if (this.disabled) return;
    const next = value && value !== 'PENDIENTE' ? value : 'PENDIENTE';
    this.selected = next;
    this.selectedChange.emit(next);
  }

  private rebuildOptions(): void {
    this.buttons = buildStatusCatalogoButtons(this.catalogo);
    this.options = this.buttons.map((b) => ({
      id: b.codigo,
      label: b.etiqueta,
    }));
  }
}
