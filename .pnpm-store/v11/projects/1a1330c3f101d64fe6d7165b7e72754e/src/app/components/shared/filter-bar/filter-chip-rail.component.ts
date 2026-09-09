import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface FilterChip {
  id: string;
  label: string;
}

@Component({
  selector: 'app-filter-chip-rail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './filter-chip-rail.component.html',
  styleUrl: './filter-chip-rail.component.css',
})
export class FilterChipRailComponent {
  @Input() chips: FilterChip[] = [];
  @Input() clearLabel = 'Limpiar filtros';

  @Output() remove = new EventEmitter<string>();
  @Output() clear = new EventEmitter<void>();

  get hasChips(): boolean {
    return this.chips.length > 0;
  }
}
