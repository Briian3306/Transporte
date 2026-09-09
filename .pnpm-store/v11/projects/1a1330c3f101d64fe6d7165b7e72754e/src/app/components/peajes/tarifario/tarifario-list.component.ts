import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import {
  FilterChip,
  FilterChipRailComponent,
  SearchMultiSelectComponent,
  SearchMultiSelectOption,
  SearchSelectComponent,
} from '../../shared';
import {
  Estacion,
  PEAJES_CATALOGO_SERVICE,
  Peaje,
  PeajesCatalogoService,
} from '../models';
import {
  PEAJES_TARIFARIO_SERVICE,
  TARIFA_CATEGORIAS,
  TarifaSentido,
  TarifaStatusPico,
  TarifarioCurrentRow,
  TarifarioFilters,
  PeajesTarifarioService,
} from '../models/tarifario.contracts';
import { TarifaStatusBadgeComponent } from '../auditoria-tarifas/tarifa-status-badge.component';
import {
  MISSING_IMPORTE_LABEL,
  TARIFARIO_STATUS_CATALOG,
  formatFechaActualizacion,
  formatTarifaImporteDisplay,
} from './tarifario.helpers';

@Component({
  selector: 'app-tarifario-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    SearchMultiSelectComponent,
    SearchSelectComponent,
    FilterChipRailComponent,
    TarifaStatusBadgeComponent,
  ],
  templateUrl: './tarifario-list.component.html',
  styleUrls: ['../shared/peajes-list-shell.css', './tarifario-list.component.css'],
})
export class TarifarioListComponent implements OnInit, OnDestroy {
  private readonly filter$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  readonly statusCatalog = TARIFARIO_STATUS_CATALOG;
  readonly missingLabel = MISSING_IMPORTE_LABEL;
  readonly sentidos: TarifaSentido[] = ['IDA', 'VUELTA', 'AMBAS'];
  readonly statusQuick: TarifaStatusPico[] = ['NO_PICO', 'PICO'];

  rows: TarifarioCurrentRow[] = [];
  total = 0;
  loading = false;
  error: string | null = null;
  page = 1;
  pageSize = 50;
  sortKey = 'estacion_nombre';
  sortDirection: 'asc' | 'desc' = 'asc';
  filters: TarifarioFilters = {};

  peajes: Peaje[] = [];
  estaciones: Estacion[] = [];

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService,
    @Inject(PEAJES_TARIFARIO_SERVICE) private readonly tarifario: PeajesTarifarioService,
  ) {}

  get peajeOptions(): SearchMultiSelectOption[] {
    return this.peajes.map((p) => ({ id: p.id, label: p.nombre }));
  }

  get estacionOptions(): SearchMultiSelectOption[] {
    const peajeIds = this.filters.peaje_ids;
    const list = peajeIds?.length
      ? this.estaciones.filter((e) => peajeIds.includes(e.peaje_id))
      : this.estaciones;
    return list.map((e) => ({ id: e.id, label: e.nombre }));
  }

  get categoriaOptions(): { id: string; label: string }[] {
    return TARIFA_CATEGORIAS.map((c) => ({ id: String(c), label: String(c) }));
  }

  get categoriaFilterValue(): string | null {
    const cat = this.filters.categorias?.[0];
    return cat == null ? null : `${cat}`;
  }

  get chips(): FilterChip[] {
    const chips: FilterChip[] = [];
    if (this.filters.peaje_ids?.length) {
      chips.push({ id: 'peaje_ids', label: `Peajes: ${this.filters.peaje_ids.length}` });
    }
    if (this.filters.estacion_ids?.length) {
      chips.push({ id: 'estacion_ids', label: `Estaciones: ${this.filters.estacion_ids.length}` });
    }
    if (this.filters.categorias?.length) {
      chips.push({ id: 'categorias', label: `Categoría: ${this.filters.categorias[0]}` });
    }
    if (this.filters.status?.length) {
      chips.push({ id: 'status', label: `Status: ${this.filters.status.join(', ')}` });
    }
    if (this.filters.sentidos?.length) {
      chips.push({ id: 'sentidos', label: `Sentido: ${this.filters.sentidos.join(', ')}` });
    }
    if (this.filters.q_estacion) {
      chips.push({ id: 'q_estacion', label: `Estación: ${this.filters.q_estacion}` });
    }
    return chips;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get pageRangeLabel(): string {
    if (!this.total) return '0–0 de 0';
    const from = (this.page - 1) * this.pageSize + 1;
    const to = Math.min(this.page * this.pageSize, this.total);
    return `${from}–${to} de ${this.total}`;
  }

  ngOnInit(): void {
    this.filter$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page = 1;
        void this.loadRows();
      });
    void this.init();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.filter$.complete();
  }

  async init(): Promise<void> {
    await Promise.all([this.loadCatalogData(), this.loadRows()]);
  }

  async loadCatalogData(): Promise<void> {
    try {
      [this.peajes, this.estaciones] = await Promise.all([
        firstValueFrom(this.catalogo.listarPeajes()),
        firstValueFrom(this.catalogo.listarEstaciones()),
      ]);
    } catch {
      this.peajes = [];
      this.estaciones = [];
    }
  }

  async loadRows(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const result = await firstValueFrom(
        this.tarifario.listar({
          filters: this.filters,
          page: this.page,
          pageSize: this.pageSize,
          sort: `${this.sortKey}:${this.sortDirection}`,
        }),
      );
      this.rows = result.rows;
      this.total = result.total;
    } catch {
      this.error = 'No se pudieron cargar las tarifas actuales. Reintentá o quitá filtros.';
      this.rows = [];
      this.total = 0;
    } finally {
      this.loading = false;
    }
  }

  patchFilters(partial: Partial<TarifarioFilters>): void {
    this.filters = { ...this.filters, ...partial };
    this.filter$.next(JSON.stringify(this.filters));
  }

  onPeajes(ids: string[]): void {
    this.patchFilters({ peaje_ids: ids.length ? ids : undefined, estacion_ids: undefined });
  }

  onEstaciones(ids: string[]): void {
    this.patchFilters({ estacion_ids: ids.length ? ids : undefined });
  }

  onCategoria(value: string | null): void {
    this.patchFilters({ categorias: value != null && value !== '' ? [Number(value)] : undefined });
  }

  onStatus(ids: string[]): void {
    this.patchFilters({ status: ids.length ? (ids as TarifaStatusPico[]) : undefined });
  }

  toggleStatusQuick(code: TarifaStatusPico): void {
    const current = new Set(this.filters.status ?? []);
    if (current.has(code)) current.delete(code);
    else current.add(code);
    this.onStatus([...current]);
  }

  isStatusQuickActive(code: TarifaStatusPico): boolean {
    return this.filters.status?.includes(code) ?? false;
  }

  onSentido(sentido: TarifaSentido | null): void {
    this.patchFilters({ sentidos: sentido ? [sentido] : undefined });
  }

  onQEstacion(value: string): void {
    this.patchFilters({ q_estacion: value.trim() || undefined });
  }

  removeChip(id: string): void {
    if (id === 'peaje_ids') this.patchFilters({ peaje_ids: undefined });
    else if (id === 'estacion_ids') this.patchFilters({ estacion_ids: undefined });
    else if (id === 'categorias') this.patchFilters({ categorias: undefined });
    else if (id === 'status') this.patchFilters({ status: undefined });
    else if (id === 'sentidos') this.patchFilters({ sentidos: undefined });
    else if (id === 'q_estacion') this.patchFilters({ q_estacion: undefined });
  }

  clearFilters(): void {
    this.filters = {};
    this.filter$.next('{}');
  }

  ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    if (this.sortKey !== key) return 'none';
    return this.sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  onSort(key: string): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
    this.page = 1;
    void this.loadRows();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.page = 1;
    void this.loadRows();
  }

  goPage(page: number): void {
    const next = Math.min(Math.max(1, page), this.totalPages);
    if (next === this.page) return;
    this.page = next;
    void this.loadRows();
  }

  trackByRow(_index: number, row: TarifarioCurrentRow): string {
    return row.tarifa_id;
  }

  editorHref(row: TarifarioCurrentRow): string[] {
    return ['/peajes/tarifario', row.peaje_id, row.estacion_id, row.sentido];
  }

  formatImporte(row: TarifarioCurrentRow): string {
    return formatTarifaImporteDisplay(row.importe);
  }

  formatFecha(row: TarifarioCurrentRow): string {
    return formatFechaActualizacion(row.fecha_actualizacion);
  }

  emptyMessage(): string {
    if (this.loading) return 'Cargando tarifas actuales…';
    if (this.chips.length) return 'No hay tarifas actuales para estos filtros.';
    return 'Todavía no hay tarifas actuales. Cuando exista el catálogo v2 vas a ver los precios vigentes acá.';
  }
}
