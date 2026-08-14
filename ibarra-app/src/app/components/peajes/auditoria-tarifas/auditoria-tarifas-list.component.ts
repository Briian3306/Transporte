import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import {
  DataTablePageChange,
  DataTableSort,
  DateRangePickerComponent,
  DateRangeValue,
  DialogComponent,
  FilterChip,
  FilterChipRailComponent,
  SearchMultiSelectComponent,
  SearchMultiSelectOption,
  SearchSelectComponent,
  rangeToIsoFilters,
} from '../../shared';
import {
  Empresa,
  Estacion,
  PEAJES_CATALOGO_SERVICE,
  PEAJES_PASADAS_SERVICE,
  PasadaGestion,
  Peaje,
  PeajesCatalogoService,
  PeajesPasadasService,
} from '../models';
import {
  PeajesAuditoriaTarifasService,
  PEAJES_AUDITORIA_TARIFAS_SERVICE,
  TarifaAsignacion,
  TarifaDiagnostico,
  TarifaFamilia,
  TarifaGrupoSimilar,
  TarifaNormalizadaRow,
  TarifaStatusCatalogo,
  TarifasNormalizadasFilters,
} from './contracts.local';
import {
  DIAGNOSTICO_BADGE_CLASS,
  DIAGNOSTICO_LABELS,
  DIAGNOSTICO_OPTIONS,
  patronFromRow,
} from './auditoria-tarifas.helpers';
import { TarifaFamiliaPanelComponent } from './tarifa-familia-panel.component';
import { TarifaStatusBadgeComponent } from './tarifa-status-badge.component';
import { TarifaCompararDialogComponent } from './tarifa-comparar-dialog.component';
import { TarifaCasosDialogComponent } from './tarifa-casos-dialog.component';
import { formatUtcDateShort } from '../wizard/services/peajes-fecha.util';

interface PeajeProgress {
  peaje_id: string;
  peaje_nombre: string;
  total: number;
  pendientes: number;
}

@Component({
  selector: 'app-auditoria-tarifas-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DateRangePickerComponent,
    SearchMultiSelectComponent,
    SearchSelectComponent,
    FilterChipRailComponent,
    DialogComponent,
    TarifaFamiliaPanelComponent,
    TarifaStatusBadgeComponent,
    TarifaCompararDialogComponent,
    TarifaCasosDialogComponent,
  ],
  templateUrl: './auditoria-tarifas-list.component.html',
  styleUrl: './auditoria-tarifas-list.component.css',
})
export class AuditoriaTarifasListComponent implements OnInit, OnDestroy {
  private readonly filter$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  rows: TarifaNormalizadaRow[] = [];
  total = 0;
  loading = false;
  error: string | null = null;

  page = 1;
  pageSize = 50;
  sortKey = 'cases';
  sortDirection: 'asc' | 'desc' = 'desc';
  filters: TarifasNormalizadasFilters = {};

  peajes: Peaje[] = [];
  empresas: Empresa[] = [];
  estaciones: Estacion[] = [];
  categorias: string[] = [];
  catalogByPeaje = new Map<string, TarifaStatusCatalogo[]>();

  expandedId: string | null = null;
  familiaNiveles: TarifaNormalizadaRow[] = [];
  familiaLoading = false;
  familiaConfirmError: string | null = null;
  familiaSaving = false;

  progress: PeajeProgress[] = [];
  progressLoading = false;
  progressOpen = false;

  recalcDialogOpen = false;
  recalculating = false;
  recalcNotice: string | null = null;
  recalcError: string | null = null;

  compareOpen = false;
  compareFamilia: TarifaFamilia | null = null;
  compareSimilares: TarifaGrupoSimilar[] = [];
  compareLoading = false;
  compareSaving = false;
  compareError: string | null = null;
  compareTolerancia = 0.05;
  compareSourceRow: TarifaNormalizadaRow | null = null;

  casosOpen = false;
  casosNivel: TarifaNormalizadaRow | null = null;
  casosRows: PasadaGestion[] = [];
  casosTotal = 0;
  casosLoading = false;
  casosError: string | null = null;
  casosPage = 1;
  casosPageSize = 50;
  casosSort: DataTableSort = { key: 'fecha_hora', direction: 'desc' };

  tarifaUrlDialogOpen = false;
  tarifaUrlEmpresa: Empresa | null = null;
  tarifaUrlDraft = '';
  tarifaUrlSaving = false;
  tarifaUrlError: string | null = null;

  readonly diagnosticoOptions = DIAGNOSTICO_OPTIONS;
  private readonly tarifaUrlPattern = /^https?:\/\/\S+$/i;

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService,
    @Inject(PEAJES_AUDITORIA_TARIFAS_SERVICE) private readonly auditoria: PeajesAuditoriaTarifasService,
    @Inject(PEAJES_PASADAS_SERVICE) private readonly pasadas: PeajesPasadasService
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

  get statusOptions(): SearchMultiSelectOption[] {
    const base: SearchMultiSelectOption[] = [
      { id: 'PENDIENTE', label: 'Sin clasificar' },
      { id: 'POSIBLE_HORARIO', label: 'Posible horario' },
    ];
    const peajeIds = this.filters.peaje_ids?.length
      ? this.filters.peaje_ids
      : [...this.catalogByPeaje.keys()];
    const seen = new Set<string>(['PENDIENTE', 'POSIBLE_HORARIO']);
    peajeIds.forEach((pid) => {
      (this.catalogByPeaje.get(pid) ?? []).forEach((c) => {
        if (c.codigo !== 'CONFIRMADO' && !seen.has(c.codigo)) {
          seen.add(c.codigo);
          base.push({ id: c.codigo, label: c.etiqueta });
        }
      });
    });
    return base;
  }

  get statusQuickOptions(): SearchMultiSelectOption[] {
    return this.statusOptions.filter((option) => option.id !== 'POSIBLE_HORARIO').slice(0, 5);
  }

  get progressSummary(): { total: number; classified: number; pending: number; pct: number } {
    const total = this.progress.reduce((sum, item) => sum + item.total, 0);
    const pending = this.progress.reduce((sum, item) => sum + item.pendientes, 0);
    const classified = Math.max(0, total - pending);
    return { total, classified, pending, pct: total ? Math.round((classified / total) * 100) : 0 };
  }

  get categoriaOptions(): { id: string; label: string }[] {
    return this.categorias.map((c) => ({ id: c, label: c }));
  }

  get categoriaDisabled(): boolean {
    return this.categorias.length === 0;
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
    if (this.filters.peaje_ids?.length) {
      chips.push({ id: 'peaje_ids', label: `Peajes: ${this.filters.peaje_ids.length}` });
    }
    if (this.filters.estacion_ids?.length) {
      chips.push({ id: 'estacion_ids', label: `Estaciones: ${this.filters.estacion_ids.length}` });
    }
    if (this.filters.categorias?.length) {
      chips.push({ id: 'categorias', label: `Categoría: ${this.filters.categorias[0]}` });
    }
    if (this.filters.diagnosticos?.length) {
      chips.push({ id: 'diagnosticos', label: `Diagnóstico: ${this.filters.diagnosticos.length}` });
    }
    if (this.filters.status?.length) {
      chips.push({ id: 'status', label: `Status: ${this.filters.status.join(', ')}` });
    }
    if (this.filters.patron) {
      chips.push({ id: 'patron', label: `Patrón: ${this.filters.patron}` });
    }
    if (this.filters.solo_muestra_confiable) {
      chips.push({ id: 'solo_muestra_confiable', label: 'Solo muestra confiable' });
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

  get canRecalcular(): boolean {
    return (this.filters.peaje_ids?.length ?? 0) === 1;
  }

  get recalcPeajeName(): string {
    const id = this.filters.peaje_ids?.[0];
    return this.peajes.find((p) => p.id === id)?.nombre ?? '';
  }

  get allProgressComplete(): boolean {
    return this.progress.length > 0 && this.progress.every((p) => p.pendientes === 0);
  }

  get expandedCatalogo(): TarifaStatusCatalogo[] {
    const row = this.rows.find((item) => item.id === this.expandedId);
    return row ? this.catalogForRow(row) : [];
  }

  get casosTitle(): string {
    if (!this.casosNivel) return 'Pasadas';
    return `Pasadas · ${this.casosNivel.estacion_nombre} · ${this.casosNivel.importe.toFixed(2)}`;
  }

  get casosDescription(): string {
    if (!this.casosNivel) return '';
    return `${this.casosNivel.cases} casos de este nivel de tarifa.`;
  }

  ngOnInit(): void {
    this.filter$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page = 1;
        void this.loadRows();
        void this.loadProgress();
      });

    void this.init();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.filter$.complete();
  }

  async init(): Promise<void> {
    await Promise.all([this.loadCatalogData(), this.loadRows(), this.loadProgress()]);
  }

  async loadCatalogData(): Promise<void> {
    try {
      [this.peajes, this.empresas, this.estaciones] = await Promise.all([
        firstValueFrom(this.catalogo.listarPeajes()),
        firstValueFrom(this.catalogo.listarEmpresas()),
        firstValueFrom(this.catalogo.listarEstaciones()),
      ]);
      await Promise.all(
        this.peajes.map(async (p) => {
          const cat = await firstValueFrom(this.auditoria.listarStatusCatalogo(p.id));
          this.catalogByPeaje.set(p.id, cat);
        })
      );
      await this.loadCategorias();
    } catch {
      this.peajes = [];
      this.empresas = [];
      this.estaciones = [];
    }
  }

  async loadCategorias(): Promise<void> {
    try {
      this.categorias = await firstValueFrom(
        this.auditoria.listarCategorias(this.filters.peaje_ids)
      );
    } catch {
      this.categorias = [];
    }
  }

  async loadRows(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const result = await firstValueFrom(
        this.auditoria.listar({
          filters: this.filters,
          page: this.page,
          pageSize: this.pageSize,
          sort: `${this.sortKey}:${this.sortDirection}`,
        })
      );
      this.rows = result.rows;
      this.total = result.total;
      if (this.expandedId && !this.rows.some((r) => r.id === this.expandedId)) {
        this.collapseDetail();
      }
    } catch {
      this.error = 'No se pudieron cargar las familias de tarifa. Reintentá o quitá filtros.';
      this.rows = [];
      this.total = 0;
    } finally {
      this.loading = false;
    }
  }

  async loadProgress(): Promise<void> {
    this.progressLoading = true;
    try {
      const peajeIds = this.filters.peaje_ids?.length
        ? this.filters.peaje_ids
        : this.peajes.map((p) => p.id);

      const entries = await Promise.all(
        peajeIds.map(async (peajeId) => {
          const baseFilters = { ...this.filters, peaje_ids: [peajeId] };
          const [all, pending] = await Promise.all([
            firstValueFrom(
              this.auditoria.listar({ filters: baseFilters, page: 1, pageSize: 1 })
            ),
            firstValueFrom(
              this.auditoria.listar({
                filters: { ...baseFilters, status: ['PENDIENTE'] },
                page: 1,
                pageSize: 1,
              })
            ),
          ]);
          const peaje = this.peajes.find((p) => p.id === peajeId);
          return {
            peaje_id: peajeId,
            peaje_nombre: peaje?.nombre ?? peajeId,
            total: all.total,
            pendientes: pending.total,
          };
        })
      );
      this.progress = entries
        .filter((e) => e.total > 0)
        .sort((a, b) => b.pendientes - a.pendientes || a.peaje_nombre.localeCompare(b.peaje_nombre, 'es'));
    } catch {
      this.progress = [];
    } finally {
      this.progressLoading = false;
    }
  }

  patchFilters(partial: Partial<TarifasNormalizadasFilters>): void {
    this.filters = { ...this.filters, ...partial };
    this.filter$.next(JSON.stringify(this.filters));
    if ('peaje_ids' in partial) {
      void this.loadCategorias();
    }
  }

  onDateRange(range: DateRangeValue): void {
    const iso = rangeToIsoFilters(range);
    this.patchFilters({ fecha_desde: iso.fecha_desde, fecha_hasta: iso.fecha_hasta });
  }

  onPeajes(ids: string[]): void {
    this.patchFilters({ peaje_ids: ids.length ? ids : undefined, estacion_ids: undefined });
  }

  onEstaciones(ids: string[]): void {
    this.patchFilters({ estacion_ids: ids.length ? ids : undefined });
  }

  onCategoria(value: string | null): void {
    this.patchFilters({ categorias: value ? [value] : undefined });
  }

  onDiagnosticos(ids: string[]): void {
    this.patchFilters({
      diagnosticos: ids.length ? (ids as TarifaDiagnostico[]) : undefined,
    });
  }

  onStatus(ids: string[]): void {
    this.patchFilters({ status: ids.length ? ids : undefined });
  }

  toggleStatusQuick(code: string): void {
    const current = new Set(this.filters.status ?? []);
    if (current.has(code)) current.delete(code);
    else current.add(code);
    this.onStatus([...current]);
  }

  isStatusQuickActive(code: string): boolean {
    return this.filters.status?.includes(code) ?? false;
  }

  statusQuickLabel(code: string): string {
    return this.statusOptions.find((option) => option.id === code)?.label ?? code;
  }

  onPatron(patron: 'A' | 'B' | null): void {
    this.patchFilters({ patron });
  }

  onSoloConfiable(checked: boolean): void {
    this.patchFilters({ solo_muestra_confiable: checked || undefined });
  }

  onQEstacion(value: string): void {
    this.patchFilters({ q_estacion: value.trim() || undefined });
  }

  removeChip(id: string): void {
    if (id === 'fecha_desde') this.patchFilters({ fecha_desde: null });
    else if (id === 'fecha_hasta') this.patchFilters({ fecha_hasta: null });
    else if (id === 'peaje_ids') this.patchFilters({ peaje_ids: undefined });
    else if (id === 'estacion_ids') this.patchFilters({ estacion_ids: undefined });
    else if (id === 'categorias') this.patchFilters({ categorias: undefined });
    else if (id === 'diagnosticos') this.patchFilters({ diagnosticos: undefined });
    else if (id === 'status') this.patchFilters({ status: undefined });
    else if (id === 'patron') this.patchFilters({ patron: null });
    else if (id === 'solo_muestra_confiable') this.patchFilters({ solo_muestra_confiable: undefined });
    else if (id === 'q_estacion') this.patchFilters({ q_estacion: undefined });
  }

  clearFilters(): void {
    this.filters = {};
    this.filter$.next('{}');
    void this.loadCategorias();
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
      this.sortDirection = 'desc';
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

  toggleExpand(row: TarifaNormalizadaRow): void {
    if (this.expandedId === row.id) {
      this.collapseDetail();
      return;
    }
    this.expandedId = row.id;
    this.familiaConfirmError = null;
    void this.loadFamilia(row);
  }

  openDetail(row: TarifaNormalizadaRow): void {
    if (this.expandedId === row.id) return;
    this.expandedId = row.id;
    this.familiaConfirmError = null;
    void this.loadFamilia(row);
  }

  collapseDetail(): void {
    this.expandedId = null;
    this.familiaNiveles = [];
    this.familiaConfirmError = null;
  }

  async loadFamilia(row: TarifaNormalizadaRow): Promise<void> {
    this.familiaLoading = true;
    try {
      const result = await firstValueFrom(
        this.auditoria.listar({
          filters: {
            estacion_ids: [row.estacion_id],
            categorias: row.categoria ? [row.categoria] : undefined,
          },
          page: 1,
          pageSize: 100,
          sort: 'importe:asc',
        })
      );
      this.familiaNiveles = result.rows;
    } catch {
      this.familiaNiveles = [];
    } finally {
      this.familiaLoading = false;
    }
  }

  async onConfirmFamilia(asignaciones: TarifaAsignacion[]): Promise<void> {
    this.familiaSaving = true;
    this.familiaConfirmError = null;
    try {
      await firstValueFrom(this.auditoria.confirmarStatus(asignaciones));
      await Promise.all([this.loadRows(), this.loadProgress()]);
      if (this.expandedId) {
        const row = this.rows.find((r) => r.id === this.expandedId);
        if (row) await this.loadFamilia(row);
      }
    } catch {
      this.familiaConfirmError =
        'No se pudo guardar la clasificación. Revisá la conexión y volvé a confirmar.';
    } finally {
      this.familiaSaving = false;
    }
  }

  async onMarcarDiagnostico(diagnostico: TarifaDiagnostico): Promise<void> {
    if (!this.familiaNiveles.length) return;
    this.familiaSaving = true;
    try {
      for (const n of this.familiaNiveles) {
        await firstValueFrom(this.auditoria.marcarDiagnostico(n.id, diagnostico));
      }
      await this.loadRows();
      const row = this.rows.find((r) => r.id === this.expandedId);
      if (row) await this.loadFamilia(row);
    } finally {
      this.familiaSaving = false;
    }
  }

  openCompare(row: TarifaNormalizadaRow, event?: Event): void {
    event?.stopPropagation();
    this.compareSourceRow = row;
    this.compareFamilia = {
      estacion_id: row.estacion_id,
      estacion_nombre: row.estacion_nombre,
      peaje_id: row.peaje_id,
      categoria: row.categoria,
      niveles: this.familiaNiveles.length ? this.familiaNiveles : [row],
    };
    this.compareOpen = true;
    this.compareError = null;
    void this.loadSimilares(row.id, this.compareTolerancia);
  }

  async loadSimilares(tarifaId: string, tolerancia: number): Promise<void> {
    this.compareLoading = true;
    try {
      this.compareSimilares = await firstValueFrom(
        this.auditoria.gruposSimilares(tarifaId, tolerancia)
      );
    } catch {
      this.compareSimilares = [];
      this.compareError = 'No se pudieron cargar los grupos similares.';
    } finally {
      this.compareLoading = false;
    }
  }

  onCompareTolerancia(tol: number): void {
    this.compareTolerancia = tol;
    if (this.compareSourceRow) {
      void this.loadSimilares(this.compareSourceRow.id, tol);
    }
  }

  async onApplyCompare(asignaciones: TarifaAsignacion[]): Promise<void> {
    this.compareSaving = true;
    this.compareError = null;
    try {
      await firstValueFrom(this.auditoria.confirmarStatus(asignaciones));
      this.compareOpen = false;
      await Promise.all([this.loadRows(), this.loadProgress()]);
    } catch {
      this.compareError = 'No se pudo aplicar la clasificación.';
    } finally {
      this.compareSaving = false;
    }
  }

  openVerCasos(nivel: TarifaNormalizadaRow): void {
    this.casosNivel = nivel;
    this.casosPage = 1;
    this.casosSort = { key: 'fecha_hora', direction: 'desc' };
    this.casosOpen = true;
    this.casosError = null;
    void this.loadCasos();
  }

  async loadCasos(): Promise<void> {
    if (!this.casosNivel) return;
    this.casosLoading = true;
    this.casosError = null;
    try {
      const result = await firstValueFrom(
        this.pasadas.listar({
          filters: { tarifa_normalizada_id: this.casosNivel.id },
          sort: this.casosSort.key,
          dir: this.casosSort.direction,
          limit: this.casosPageSize,
          offset: (this.casosPage - 1) * this.casosPageSize,
        })
      );
      this.casosRows = result.rows;
      this.casosTotal = result.total;
    } catch {
      this.casosRows = [];
      this.casosTotal = 0;
      this.casosError = 'No se pudieron cargar las pasadas de este nivel.';
    } finally {
      this.casosLoading = false;
    }
  }

  onCasosSort(sort: DataTableSort): void {
    this.casosSort = sort;
    this.casosPage = 1;
    void this.loadCasos();
  }

  onCasosPage(change: DataTablePageChange): void {
    this.casosPage = change.page;
    this.casosPageSize = change.pageSize;
    void this.loadCasos();
  }

  closeCasos(): void {
    this.casosOpen = false;
    this.casosNivel = null;
    this.casosRows = [];
    this.casosTotal = 0;
    this.casosError = null;
  }

  empresaForRow(row: TarifaNormalizadaRow): Empresa | null {
    const peaje = this.peajes.find((item) => item.id === row.peaje_id);
    if (!peaje?.empresa_id || peaje.empresa_id === '__global__') return null;
    return this.empresas.find((item) => item.id === peaje.empresa_id) ?? null;
  }

  tarifaUrlForRow(row: TarifaNormalizadaRow): string | null {
    const url = this.empresaForRow(row)?.tarifa_url?.trim();
    return url || null;
  }

  openTarifaUrlDialog(row: TarifaNormalizadaRow, event?: Event): void {
    event?.stopPropagation();
    const empresa = this.empresaForRow(row);
    if (!empresa) {
      this.tarifaUrlError = 'Este peaje no tiene empresa asociada.';
      return;
    }
    this.tarifaUrlEmpresa = empresa;
    this.tarifaUrlDraft = empresa.tarifa_url ?? '';
    this.tarifaUrlError = null;
    this.tarifaUrlDialogOpen = true;
  }

  closeTarifaUrlDialog(): void {
    this.tarifaUrlDialogOpen = false;
    this.tarifaUrlEmpresa = null;
    this.tarifaUrlDraft = '';
    this.tarifaUrlError = null;
  }

  get tarifaUrlDialogTitle(): string {
    return this.tarifaUrlEmpresa
      ? `URL de tarifas · ${this.tarifaUrlEmpresa.nombre}`
      : 'URL de tarifas';
  }

  async saveTarifaUrl(): Promise<void> {
    if (!this.tarifaUrlEmpresa) return;
    const url = this.tarifaUrlDraft.trim() || null;
    if (url && !this.tarifaUrlPattern.test(url)) {
      this.tarifaUrlError = 'La URL debe empezar con http:// o https://';
      return;
    }
    this.tarifaUrlSaving = true;
    this.tarifaUrlError = null;
    try {
      const updated = await firstValueFrom(
        this.catalogo.actualizarEmpresa(this.tarifaUrlEmpresa.id, { tarifa_url: url })
      );
      this.empresas = this.empresas.map((item) => (item.id === updated.id ? updated : item));
      this.closeTarifaUrlDialog();
    } catch {
      this.tarifaUrlError = 'No se pudo guardar la URL. Revisá el formato y volvé a intentar.';
    } finally {
      this.tarifaUrlSaving = false;
    }
  }

  openRecalcDialog(): void {
    if (!this.canRecalcular) return;
    this.recalcDialogOpen = true;
  }

  async confirmRecalc(): Promise<void> {
    const peajeId = this.filters.peaje_ids?.[0];
    if (!peajeId) return;
    this.recalcDialogOpen = false;
    this.recalculating = true;
    this.recalcError = null;
    this.recalcNotice =
      'Recalculando tarifas. Puede tardar algunos minutos con muchas pasadas. Podés seguir mirando el listado; los resultados se actualizan al terminar.';
    try {
      await firstValueFrom(this.auditoria.recalcular(peajeId));
      this.recalcNotice = 'Tarifas recalculadas.';
      await Promise.all([this.loadRows(), this.loadProgress()]);
      setTimeout(() => {
        if (this.recalcNotice === 'Tarifas recalculadas.') this.recalcNotice = null;
      }, 4000);
    } catch {
      this.recalcNotice = null;
      this.recalcError = 'No se pudo recalcular. Reintentá en unos minutos.';
    } finally {
      this.recalculating = false;
    }
  }

  diagnosticoLabel(d: TarifaDiagnostico): string {
    return DIAGNOSTICO_LABELS[d];
  }

  diagnosticoClass(d: TarifaDiagnostico): string {
    return `at__badge ${DIAGNOSTICO_BADGE_CLASS[d]}`;
  }

  patronLabel(row: TarifaNormalizadaRow): string {
    return patronFromRow(row);
  }

  catalogForRow(row: TarifaNormalizadaRow): TarifaStatusCatalogo[] {
    return this.catalogByPeaje.get(row.peaje_id) ?? [];
  }

  emptyMessage(): string {
    if (this.loading) return 'Cargando familias de tarifa…';
    const hasFilters = Object.keys(this.filters).some((k) => {
      const v = (this.filters as Record<string, unknown>)[k];
      return v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
    });
    if (this.filters.status?.includes('PENDIENTE') && !this.rows.length) {
      return 'No queda ninguna familia pendiente para estos filtros.';
    }
    if (hasFilters) return 'No hay familias de tarifa con estos filtros.';
    if (!this.total) {
      return 'Todavía no se generaron familias de tarifa. Cargá pasadas desde el asistente o usá Recalcular.';
    }
    return 'No hay familias de tarifa con estos filtros.';
  }

  progressPct(item: PeajeProgress): number {
    if (!item.total) return 0;
    return Math.round(((item.total - item.pendientes) / item.total) * 100);
  }

  private formatChipDate(iso: string): string {
    try {
      return formatUtcDateShort(iso);
    } catch {
      return iso;
    }
  }
}
