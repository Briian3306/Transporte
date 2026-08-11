import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Contenedor de acordeón tipo “ledger”: paneles apilados con separadores finos.
 * Sin PrimeNG — patrón peajes/shared (standalone + proyección).
 */
@Component({
  selector: 'app-accordion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './accordion.component.html',
  styleUrl: './accordion.component.css',
})
export class AccordionComponent {
  /** Si true, varios paneles pueden estar abiertos a la vez. */
  @Input() multiple = true;

  /** Valores de paneles expandidos (controlado). */
  @Input() expandedValues: string[] = [];

  @Output() expandedValuesChange = new EventEmitter<string[]>();

  isExpanded(value: string): boolean {
    return this.expandedValues.includes(value);
  }

  toggle(value: string): void {
    const open = this.isExpanded(value);
    if (this.multiple) {
      const next = open
        ? this.expandedValues.filter((v) => v !== value)
        : [...this.expandedValues, value];
      this.expandedValues = next;
      this.expandedValuesChange.emit(next);
      return;
    }
    const next = open ? [] : [value];
    this.expandedValues = next;
    this.expandedValuesChange.emit(next);
  }

  expand(value: string): void {
    if (this.isExpanded(value)) return;
    this.toggle(value);
  }

  collapse(value: string): void {
    if (!this.isExpanded(value)) return;
    this.toggle(value);
  }
}
