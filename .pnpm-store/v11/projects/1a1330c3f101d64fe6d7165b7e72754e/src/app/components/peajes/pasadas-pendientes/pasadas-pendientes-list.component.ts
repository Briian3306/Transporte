import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import {
  DataTableColumn,
  DataTableColumnDirective,
  DataTableComponent,
  DataTablePageChange,
  DataTableSort,
  DateRangePickerComponent,
  DateRangeValue,
  FilterChip,
  FilterChipRailComponent,
  SearchMultiSelectComponent,
  SearchMultiSelectOption,
  rangeToIsoFilters,
} from '../../shared';
import {
  Empresa,
  EstacionPendienteGrupo,
  EstacionesPendientesListFilters,
  PEAJES_CATALOGO_SERVICE,
  PEAJES_PASADAS_SERVICE,
  PasadaGestion,
  PeajesCatalogoService,
  PeajesPasadasService,
  stationBadgeFromCoords,
} from '../models';
import { formatUtcDateShort, formatUtcDateTime } from '../wizard/services/peajes-fecha.util';
import {
  EstacionUbicacionDrawerComponent,
  EstacionUbicacionPayload,
} from './estacion-ubicacion-drawer.component';

@Component({
  selector: 'app-pasadas-pendientes-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DataTableComponent,
    DataTableColumnDirective,
    FilterChipRailComponent,
    DateRangePickerComponent,
    SearchMultiSelectComponent,
    EstacionUbicacionDrawerComponent,
  ],
  templateUrl: './pasadas-pendientes-list.component.html',
  styleUrl: './pasadas-pendientes-list.component.css',
})
export class PasadasPendientesListComponent implements OnInit, OnDestroy {
  private readonly filter$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  rows: EstacionPendienteGrupo[] = [];
  total = 0;
  loading = false;
  error: string | null = null;

  page = 1;
  pageSize = 50;
  sort: DataTableSort = { key: 'cantidad_pasadas', direction: 'desc' };
  filters: EstacionesPendientesListFilters = {};
  empresas: Empresa[] = [];

  expandedId: string | null = null;
  detailRows: PasadaGestion[] = [];
  detailTotal = 0;
  detailLoading = false;
  detailPage = 1;
  detailPageSize = 25;
  detailSort: DataTableSort = { key: 'fecha_hora', direction: 'desc' };
  detailError: string | null = null;

  drawerOpen = false;
  selectedGroup: EstacionPendienteGrupo | null = null;
  saving = false;
  drawerError: string | null = null;

  readonly detailColumns: DataTableColumn[] = [
    { key: 'fecha_hora', label: 'Fecha', sortable: true, width: '11rem' },
    { key: 'patente_codigo', label: 'Patente', sortable: true, width: '8rem' },
    { key: 'pase_codigo', label: 'Pase', sortable: true, width: '7rem' },
    { key: 'precio', label: 'Precio', sortable: true, align: 'right', width: '7rem' },
    { key: 'importe_neto', label: 'Neto', sortable: true, align: 'right', width: '7rem' },
    { key: 'documento_numero', label: 'Documento', sortable: false },
  ];

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService,
    @Inject(PEAJES_PASADAS_SERVICE) private readonly pasadas: PeajesPasadasService
  ) {}

  get empresaOptions(): SearchMultiSelectOption[] {
    return this.empresas.map((e) => ({ id: e.id, label: e.nombre }));
  }

  get dateRange(): DateRangeValue {
    return {
      from: this.filters.fecha_desde ? new Date(this.filters.fecha_desde) : null,
      to: this.filters.fecha_hasta ? new Date(this.filters.fecha_hasta) : null,
    };
  }

  get chips(): FilterChip[] {
    const chips: FilterChip[] = [];
    if (this.filters.fecha_desde) {
      chips.push({ id: 'fecha_desde', label: `Desde: ${this.formatChipDate(this.filters.fecha_desde)}` });
    }
    if (this.filters.fecha_hasta) {
      chips.push({ id: 'fecha_hasta', label: `Hasta: ${this.formatChipDate(this.filters.fecha_hasta)}` });
    }
    if (this.filters.q_estacion) {
      chips.push({ id: 'q_estacion', label: `Estación: ${this.filters.q_estacion}` });
    }
    if (this.filters.empresa_ids?.length) {
      chips.push({ id: 'empresa_ids', label: `Empresas: ${this.filters.empresa_ids.length}` });
    }
    return chips;
  }

  get detailTableRows(): Record<string, unknown>[] {
    return this.detailRows as unknown as Record<string, unknown>[];
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  async ngOnInit(): Promise<void> {
    this.filter$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page = 1;
        void this.loadRows();
      });

    await Promise.all([this.loadEmpresas(), this.loadRows()]);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.filter$.complete();
  }

  badge(group: EstacionPendienteGrupo): 'OK' | 'PENDING' {
    return stationBadgeFromCoords(group.estacion_latitud, group.estacion_longitud);
  }

  asPasada(row: Record<string, unknown>): PasadaGestion {
    return row as unknown as PasadaGestion;
  }

  async loadEmpresas(): Promise<void> {
    try {
      this.empresas = await firstValueFrom(this.catalogo.listarEmpresas());
    } catch {
      this.empresas = [];
    }
  }

  async loadRows(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const result = await firstValueFrom(
        this.pasadas.listarEstacionesPendientes({
          filters: {
            fecha_desde: this.filters.fecha_desde ?? null,
            fecha_hasta: this.filters.fecha_hasta ?? null,
            empresa_ids: this.filters.empresa_ids,
            q_estacion: this.filters.q_estacion,
            q_empresa: this.filters.q_empresa,
          },
          sort: this.sort.key,
          dir: this.sort.direction,
          limit: this.pageSize,
          offset: (this.page - 1) * this.pageSize,
        })
      );
      this.rows = result.rows;
      this.total = result.total;
      if (this.expandedId && !this.rows.some((r) => r.estacion_id === this.expandedId)) {
        this.collapseDetail();
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudieron cargar las estaciones pendientes';
      this.rows = [];
      this.total = 0;
    } finally {
      this.loading = false;
    }
  }

  onDateRange(range: DateRangeValue): void {
    const iso = rangeToIsoFilters(range);
    this.patchFilters({ fecha_desde: iso.fecha_desde, fecha_hasta: iso.fecha_hasta });
  }

  onEmpresas(ids: string[]): void {
    this.patchFilters({ empresa_ids: ids.length ? ids : undefined });
  }

  onQEstacion(value: string): void {
    this.patchFilters({ q_estacion: value.trim() || undefined });
  }

  patchFilters(partial: Partial<EstacionesPendientesListFilters>): void {
    this.filters = { ...this.filters, ...partial };
    this.filter$.next(JSON.stringify(this.filters));
  }

  removeChip(id: string): void {
    if (id === 'fecha_desde') this.patchFilters({ fecha_desde: null });
    else if (id === 'fecha_hasta') this.patchFilters({ fecha_hasta: null });
    else if (id === 'q_estacion') this.patchFilters({ q_estacion: undefined });
    else if (id === 'empresa_ids') this.patchFilters({ empresa_ids: undefined });
  }

  clearFilters(): void {
    this.filters = {};
    this.filter$.next('{}');
  }

  onSort(key: string): void {
    if (this.sort.key === key) {
      this.sort = {
        key,
        direction: this.sort.direction === 'asc' ? 'desc' : 'asc',
      };
    } else {
      this.sort = { key, direction: 'desc' };
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

  toggleExpand(group: EstacionPendienteGrupo): void {
    if (this.expandedId === group.estacion_id) {
      this.collapseDetail();
      return;
    }
    this.expandedId = group.estacion_id;
    this.detailPage = 1;
    void this.loadDetail();
  }

  collapseDetail(): void {
    this.expandedId = null;
    this.detailRows = [];
    this.detailTotal = 0;
    this.detailError = null;
  }

  async loadDetail(): Promise<void> {
    if (!this.expandedId) return;
    this.detailLoading = true;
    this.detailError = null;
    try {
      const result = await firstValueFrom(
        this.pasadas.listar({
          filters: {
            estacion_ids: [this.expandedId],
            fecha_desde: this.filters.fecha_desde ?? null,
            fecha_hasta: this.filters.fecha_hasta ?? null,
          },
          sort: this.detailSort.key,
          dir: this.detailSort.direction,
          limit: this.detailPageSize,
          offset: (this.detailPage - 1) * this.detailPageSize,
        })
      );
      this.detailRows = result.rows;
      this.detailTotal = result.total;
    } catch (e) {
      this.detailError = e instanceof Error ? e.message : 'No se pudieron cargar las pasadas';
      this.detailRows = [];
      this.detailTotal = 0;
    } finally {
      this.detailLoading = false;
    }
  }

  onDetailSort(sort: DataTableSort): void {
    this.detailSort = sort;
    this.detailPage = 1;
    void this.loadDetail();
  }

  onDetailPage(ev: DataTablePageChange): void {
    this.detailPage = ev.page;
    this.detailPageSize = ev.pageSize;
    void this.loadDetail();
  }

  openLocation(group: EstacionPendienteGrupo, event?: Event): void {
    event?.stopPropagation();
    this.selectedGroup = group;
    this.drawerError = null;
    this.drawerOpen = true;
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.drawerError = null;
  }

  async saveLocation(payload: EstacionUbicacionPayload): Promise<void> {
    if (!this.selectedGroup) return;
    this.saving = true;
    this.drawerError = null;
    try {
      const estado =
        payload.latitud != null && payload.longitud != null ? ('OK' as const) : ('REVIEW' as const);
      await firstValueFrom(
        this.catalogo.actualizarEstacion(this.selectedGroup.estacion_id, {
          latitud: payload.latitud,
          longitud: payload.longitud,
          camino: payload.camino,
          ubicacion: payload.ubicacion,
          estado_geocodificacion: estado,
        })
      );
      this.closeDrawer();
      await this.loadRows();
    } catch (e) {
      this.drawerError = e instanceof Error ? e.message : 'No se pudo guardar la ubicación';
    } finally {
      this.saving = false;
    }
  }

  formatFechaHora(value: string | null | undefined): string {
    return formatUtcDateTime(value, true);
  }

  formatRange(group: EstacionPendienteGrupo): string {
    const desde = formatUtcDateShort(group.fecha_desde);
    const hasta = formatUtcDateShort(group.fecha_hasta);
    return desde === hasta ? desde : `${desde} – ${hasta}`;
  }

  private formatChipDate(iso: string): string {
    try {
      return formatUtcDateShort(iso);
    } catch {
      return iso;
    }
  }
}
