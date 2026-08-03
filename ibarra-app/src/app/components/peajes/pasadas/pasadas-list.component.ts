import { Component, Inject, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import {
  DataTableColumn,
  DataTableColumnDirective,
  DataTableComponent,
  DataTablePageChange,
  DataTableSort,
  FilterChip,
  FilterChipRailComponent,
} from '../../shared';
import {
  Empresa,
  Estacion,
  Factura,
  PEAJES_CATALOGO_SERVICE,
  PEAJES_PASADAS_SERVICE,
  PasadaGestion,
  Pase,
  Patente,
  PeajesCatalogoService,
  PeajesPasadasService,
  stationBadgeFromCoords,
} from '../models';
import { SupabaseService } from '../../../services/supabase.service';
import {
  PasadasFilterState,
  PasadasFiltersComponent,
} from './pasadas-filters.component';
import {
  PasadasDrawerMode,
  PasadasFormDrawerComponent,
  PasadasFormPayload,
} from './pasadas-form-drawer.component';

@Component({
  selector: 'app-pasadas-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DataTableComponent,
    DataTableColumnDirective,
    FilterChipRailComponent,
    PasadasFiltersComponent,
    PasadasFormDrawerComponent,
  ],
  templateUrl: './pasadas-list.component.html',
  styleUrl: './pasadas-list.component.css',
})
export class PasadasListComponent implements OnInit, OnDestroy {
  private readonly supabase = inject(SupabaseService);
  private readonly filter$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  rows: PasadaGestion[] = [];
  total = 0;
  loading = false;
  error: string | null = null;

  page = 1;
  pageSize = 50;
  sort: DataTableSort = { key: 'fecha_hora', direction: 'desc' };
  selectedIds: string[] = [];

  filters: PasadasFilterState = {};
  estaciones: Estacion[] = [];
  patentes: Patente[] = [];
  empresas: Empresa[] = [];
  pases: Pase[] = [];
  facturas: Pick<Factura, 'id' | 'factura' | 'empresa_id'>[] = [];

  drawerOpen = false;
  drawerMode: PasadasDrawerMode = 'view';
  selectedRow: PasadaGestion | null = null;
  saving = false;
  drawerError: string | null = null;
  confirmDeleteId: string | null = null;

  readonly columns: DataTableColumn[] = [
    { key: 'fecha_hora', label: 'Fecha', sortable: true, width: '11rem' },
    { key: 'estacion_nombre', label: 'Estación', sortable: true },
    { key: 'patente_codigo', label: 'Patente', sortable: true, width: '8rem' },
    { key: 'empresa_nombre', label: 'Empresa', sortable: true },
    { key: 'precio', label: 'Precio', sortable: true, align: 'right', width: '7rem' },
    { key: 'importe_neto', label: 'Neto', sortable: true, align: 'right', width: '7rem' },
    { key: 'file_upload_name', label: 'Archivo', sortable: true },
    { key: 'created_at', label: 'Creado', sortable: true, width: '10rem' },
    { key: 'acciones', label: '', templateOnly: true, width: '5.5rem', align: 'right' },
  ];

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService,
    @Inject(PEAJES_PASADAS_SERVICE) private readonly pasadas: PeajesPasadasService
  ) {}

  get tableRows(): Record<string, unknown>[] {
    return this.rows as unknown as Record<string, unknown>[];
  }

  get chips(): FilterChip[] {
    const chips: FilterChip[] = [];
    if (this.filters.fecha_desde) {
      chips.push({ id: 'fecha_desde', label: `Desde: ${this.filters.fecha_desde}` });
    }
    if (this.filters.fecha_hasta) {
      chips.push({ id: 'fecha_hasta', label: `Hasta: ${this.filters.fecha_hasta}` });
    }
    if (this.filters.q_estacion) {
      chips.push({ id: 'q_estacion', label: `Estación ≈ ${this.filters.q_estacion}` });
    }
    if (this.filters.q_patente) {
      chips.push({ id: 'q_patente', label: `Patente ≈ ${this.filters.q_patente}` });
    }
    if (this.filters.q_empresa) {
      chips.push({ id: 'q_empresa', label: `Empresa ≈ ${this.filters.q_empresa}` });
    }
    for (const id of this.filters.estacion_ids ?? []) {
      const name = this.estaciones.find((e) => e.id === id)?.nombre ?? id;
      chips.push({ id: `estacion:${id}`, label: `Estación: ${name}` });
    }
    for (const id of this.filters.patente_ids ?? []) {
      const name = this.patentes.find((p) => p.id === id)?.patente ?? id;
      chips.push({ id: `patente:${id}`, label: `Patente: ${name}` });
    }
    for (const id of this.filters.empresa_ids ?? []) {
      const name = this.empresas.find((e) => e.id === id)?.nombre ?? id;
      chips.push({ id: `empresa:${id}`, label: `Empresa: ${name}` });
    }
    return chips;
  }

  async ngOnInit(): Promise<void> {
    this.filter$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page = 1;
        void this.loadRows();
      });

    await Promise.all([this.loadCatalogos(), this.loadFacturas(), this.loadRows()]);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.filter$.complete();
  }

  badge(row: PasadaGestion | Record<string, unknown>): 'OK' | 'PENDING' {
    const r = row as PasadaGestion;
    return stationBadgeFromCoords(r.estacion_latitud, r.estacion_longitud);
  }

  asPasada(row: Record<string, unknown>): PasadaGestion {
    return row as unknown as PasadaGestion;
  }

  async loadCatalogos(): Promise<void> {
    const [estaciones, patentes, empresas, pases] = await Promise.all([
      firstValueFrom(this.catalogo.listarEstaciones()),
      firstValueFrom(this.catalogo.listarPatentes()),
      firstValueFrom(this.catalogo.listarEmpresas()),
      firstValueFrom(this.catalogo.listarPases()),
    ]);
    this.estaciones = estaciones;
    this.patentes = patentes;
    this.empresas = empresas;
    this.pases = pases;
  }

  async loadFacturas(): Promise<void> {
    try {
      const client = await this.supabase.getClient();
      const { data, error } = await client
        .from('facturas')
        .select('id, factura, empresa_id')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      this.facturas = (data ?? []) as Pick<Factura, 'id' | 'factura' | 'empresa_id'>[];
    } catch {
      this.facturas = [];
    }
  }

  async loadRows(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const result = await firstValueFrom(
        this.pasadas.listar({
          filters: {
            fecha_desde: this.filters.fecha_desde
              ? new Date(this.filters.fecha_desde).toISOString()
              : null,
            fecha_hasta: this.filters.fecha_hasta
              ? new Date(this.filters.fecha_hasta).toISOString()
              : null,
            estacion_ids: this.filters.estacion_ids,
            patente_ids: this.filters.patente_ids,
            empresa_ids: this.filters.empresa_ids,
            q_estacion: this.filters.q_estacion,
            q_patente: this.filters.q_patente,
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
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudieron cargar las pasadas';
      this.rows = [];
      this.total = 0;
    } finally {
      this.loading = false;
    }
  }

  onFiltersChange(next: PasadasFilterState): void {
    this.filters = next;
    this.filter$.next(JSON.stringify(next));
  }

  removeChip(id: string): void {
    const next: PasadasFilterState = { ...this.filters };
    if (id === 'fecha_desde') next.fecha_desde = null;
    else if (id === 'fecha_hasta') next.fecha_hasta = null;
    else if (id === 'q_estacion') next.q_estacion = null;
    else if (id === 'q_patente') next.q_patente = null;
    else if (id === 'q_empresa') next.q_empresa = null;
    else if (id.startsWith('estacion:')) {
      const sid = id.slice('estacion:'.length);
      next.estacion_ids = (next.estacion_ids ?? []).filter((x) => x !== sid);
    } else if (id.startsWith('patente:')) {
      const sid = id.slice('patente:'.length);
      next.patente_ids = (next.patente_ids ?? []).filter((x) => x !== sid);
    } else if (id.startsWith('empresa:')) {
      const sid = id.slice('empresa:'.length);
      next.empresa_ids = (next.empresa_ids ?? []).filter((x) => x !== sid);
    }
    this.onFiltersChange(next);
  }

  clearFilters(): void {
    this.onFiltersChange({});
  }

  onSortChange(sort: DataTableSort): void {
    this.sort = sort;
    this.page = 1;
    void this.loadRows();
  }

  onPageChange(ev: DataTablePageChange): void {
    this.page = ev.page;
    this.pageSize = ev.pageSize;
    void this.loadRows();
  }

  onSelectionChange(ids: string[]): void {
    this.selectedIds = ids;
  }

  openCreate(): void {
    this.selectedRow = null;
    this.drawerMode = 'create';
    this.drawerError = null;
    this.drawerOpen = true;
  }

  openRow(row: PasadaGestion | Record<string, unknown>): void {
    this.selectedRow = this.asPasada(row as Record<string, unknown>);
    this.drawerMode = 'view';
    this.drawerError = null;
    this.drawerOpen = true;
  }

  openEdit(row: PasadaGestion | Record<string, unknown>): void {
    this.selectedRow = this.asPasada(row as Record<string, unknown>);
    this.drawerMode = 'edit';
    this.drawerError = null;
    this.drawerOpen = true;
  }

  requestEdit(): void {
    this.drawerMode = 'edit';
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.drawerError = null;
    this.confirmDeleteId = null;
  }

  async saveRow(payload: PasadasFormPayload): Promise<void> {
    this.saving = true;
    this.drawerError = null;
    try {
      if (this.drawerMode === 'create') {
        await firstValueFrom(
          this.pasadas.crear({
            ...payload,
            file_upload_name: 'manual',
          })
        );
      } else if (this.selectedRow) {
        await firstValueFrom(this.pasadas.actualizar(this.selectedRow.id, payload));
      }
      this.closeDrawer();
      await this.loadRows();
    } catch (e) {
      this.drawerError = e instanceof Error ? e.message : 'No se pudo guardar';
    } finally {
      this.saving = false;
    }
  }

  requestDelete(): void {
    this.confirmDeleteId = this.selectedRow?.id ?? null;
  }

  cancelDelete(): void {
    this.confirmDeleteId = null;
  }

  async confirmDelete(): Promise<void> {
    if (!this.confirmDeleteId) return;
    this.saving = true;
    this.drawerError = null;
    try {
      await firstValueFrom(this.pasadas.eliminar(this.confirmDeleteId));
      this.closeDrawer();
      this.selectedIds = this.selectedIds.filter((id) => id !== this.confirmDeleteId);
      await this.loadRows();
    } catch (e) {
      this.drawerError = e instanceof Error ? e.message : 'No se pudo eliminar';
    } finally {
      this.saving = false;
    }
  }
}
