import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Empresa, Estacion, Patente } from '../models';
import { PasadasListFilters } from '../models/peajes-services.contracts';
import {
  DateRangePickerComponent,
  DateRangeValue,
  SearchMultiSelectComponent,
  SearchMultiSelectOption,
  rangeToIsoFilters,
} from '../../shared';

export interface PasadasFilterState extends PasadasListFilters {
  /** Status stub — not applied server-side yet. */
  statusStub?: string | null;
}

@Component({
  selector: 'app-pasadas-filters',
  standalone: true,
  imports: [CommonModule, FormsModule, DateRangePickerComponent, SearchMultiSelectComponent],
  templateUrl: './pasadas-filters.component.html',
  styleUrl: './pasadas-filters.component.css',
})
export class PasadasFiltersComponent {
  @Input() value: PasadasFilterState = {};
  @Input() estaciones: Estacion[] = [];
  @Input() patentes: Patente[] = [];
  @Input() empresas: Empresa[] = [];

  @Output() valueChange = new EventEmitter<PasadasFilterState>();

  get estacionOptions(): SearchMultiSelectOption[] {
    return this.estaciones.map((e) => ({ id: e.id, label: e.nombre }));
  }

  get patenteOptions(): SearchMultiSelectOption[] {
    return this.patentes.map((p) => ({ id: p.id, label: p.patente }));
  }

  get empresaOptions(): SearchMultiSelectOption[] {
    return this.empresas.map((e) => ({ id: e.id, label: e.nombre }));
  }

  get dateRange(): DateRangeValue {
    return {
      from: this.value.fecha_desde ? new Date(this.value.fecha_desde) : null,
      to: this.value.fecha_hasta ? new Date(this.value.fecha_hasta) : null,
    };
  }

  onDateRange(range: DateRangeValue): void {
    const iso = rangeToIsoFilters(range);
    this.patch({
      fecha_desde: iso.fecha_desde,
      fecha_hasta: iso.fecha_hasta,
    });
  }

  onEstaciones(ids: string[]): void {
    this.patch({ estacion_ids: ids.length ? ids : undefined });
  }

  onPatentes(ids: string[]): void {
    this.patch({ patente_ids: ids.length ? ids : undefined });
  }

  onEmpresas(ids: string[]): void {
    this.patch({ empresa_ids: ids.length ? ids : undefined });
  }

  patch(partial: Partial<PasadasFilterState>): void {
    this.valueChange.emit({ ...this.value, ...partial });
  }
}
