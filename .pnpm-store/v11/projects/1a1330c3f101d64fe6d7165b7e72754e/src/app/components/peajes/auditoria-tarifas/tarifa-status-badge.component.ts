import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TarifaStatusCatalogo } from './contracts.local';

@Component({
  selector: 'app-tarifa-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="at__badge"
      [class.at__badge--pending]="isPending"
      [class.at__badge--neutral]="isNeutral"
      [ngStyle]="dynamicStyle"
      [attr.aria-busy]="catalogBusy || null"
      [title]="unknownTitle"
    >
      <span [class.at__code]="isUnknown">{{ label }}</span>
    </span>
  `,
  styleUrl: './tarifa-status-badge.component.css',
})
export class TarifaStatusBadgeComponent {
  @Input() codigo: string | null = null;
  @Input() catalogo: TarifaStatusCatalogo[] = [];

  get isPending(): boolean {
    return !this.codigo || this.codigo === 'PENDIENTE';
  }

  get catalogBusy(): boolean {
    return !this.isPending && this.catalogo.length === 0;
  }

  get entry(): TarifaStatusCatalogo | undefined {
    if (!this.codigo || this.isPending) return undefined;
    return this.catalogo.find((c) => c.codigo === this.codigo);
  }

  get isUnknown(): boolean {
    return !!this.codigo && !this.isPending && this.catalogo.length > 0 && !this.entry;
  }

  get isNeutral(): boolean {
    return this.isUnknown || this.catalogBusy;
  }

  get label(): string {
    if (this.isPending) return 'Sin clasificar';
    if (this.entry) return this.entry.etiqueta;
    return this.codigo ?? 'Sin clasificar';
  }

  get unknownTitle(): string | null {
    return this.isUnknown ? 'Código no definido en el catálogo de este peaje' : null;
  }

  get dynamicStyle(): Record<string, string> | null {
    if (!this.entry) return null;
    return { '--at-badge-tint': this.entry.color };
  }
}
