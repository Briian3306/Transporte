import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Empresa, Estacion, Patente } from '../models';
import { PasadasListFilters } from '../models/peajes-services.contracts';

export interface PasadasFilterState extends PasadasListFilters {
  /** Status stub — not applied server-side yet. */
  statusStub?: string | null;
}

@Component({
  selector: 'app-pasadas-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pasadas-filters.component.html',
  styleUrl: './pasadas-filters.component.css',
})
export class PasadasFiltersComponent {
  @Input() value: PasadasFilterState = {};
  @Input() estaciones: Estacion[] = [];
  @Input() patentes: Patente[] = [];
  @Input() empresas: Empresa[] = [];

  @Output() valueChange = new EventEmitter<PasadasFilterState>();

  estacionSearch = '';
  patenteSearch = '';
  empresaSearch = '';

  get estacionesFiltradas(): Estacion[] {
    const q = this.estacionSearch.trim().toLowerCase();
    if (!q) return this.estaciones.slice(0, 80);
    return this.estaciones.filter((e) => e.nombre.toLowerCase().includes(q)).slice(0, 80);
  }

  get patentesFiltradas(): Patente[] {
    const q = this.patenteSearch.trim().toLowerCase();
    if (!q) return this.patentes.slice(0, 80);
    return this.patentes.filter((p) => p.patente.toLowerCase().includes(q)).slice(0, 80);
  }

  get empresasFiltradas(): Empresa[] {
    const q = this.empresaSearch.trim().toLowerCase();
    if (!q) return this.empresas;
    return this.empresas.filter((e) => e.nombre.toLowerCase().includes(q));
  }

  patch(partial: Partial<PasadasFilterState>): void {
    this.valueChange.emit({ ...this.value, ...partial });
  }

  toggleId(field: 'estacion_ids' | 'patente_ids' | 'empresa_ids', id: string, checked: boolean): void {
    const current = new Set(this.value[field] ?? []);
    if (checked) current.add(id);
    else current.delete(id);
    this.patch({ [field]: [...current] });
  }

  isSelected(field: 'estacion_ids' | 'patente_ids' | 'empresa_ids', id: string): boolean {
    return (this.value[field] ?? []).includes(id);
  }
}
