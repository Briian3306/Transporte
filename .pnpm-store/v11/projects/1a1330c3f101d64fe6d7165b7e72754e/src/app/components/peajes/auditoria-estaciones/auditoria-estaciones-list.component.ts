import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import {
  DataTablePageChange,
  DataTableSort,
  DialogComponent,
  FilterChip,
  FilterChipRailComponent,
  SearchMultiSelectComponent,
  SearchMultiSelectOption,
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
  AuditoriaEstacionRow,
  EstadoCasoAuditoriaEstacion,
  PEAJES_AUDITORIA_ESTACIONES_SERVICE,
  PeajesAuditoriaEstacionesService,
  PreviewCorreccionEstacion,
} from '../models/auditoria-estaciones.contracts';
import { AuditoriaEstacionPanelComponent } from './auditoria-estacion-panel.component';
import { TarifaCasosDialogComponent } from '../auditoria-tarifas/tarifa-casos-dialog.component';

const ESTADO_LABELS: Record<EstadoCasoAuditoriaEstacion, string> = {
  PENDIENTE: 'Pendiente',
  VALIDADO: 'Validado',
  DESCARTADO: 'Descartado',
  REQUIERE_CORRECCION: 'Requiere corrección',
  CORREGIDO: 'Corregido',
};

const HALLAZGO_LABELS: Record<string, string> = {
  CODIGO_REPETIDO_ENTRE_ESTACIONES: 'Código repetido',
  SECUENCIA_NUMERICA_CON_SALTO: 'Salto en secuencia',
  SECUENCIA_NUMERICA_INVERTIDA: 'Secuencia invertida',
  ALIAS_DIFERENTE_CATALOGO: 'Alias distinto al catálogo',
};

@Component({
  selector: 'app-auditoria-estaciones-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    SearchMultiSelectComponent,
    FilterChipRailComponent,
    DialogComponent,
    AuditoriaEstacionPanelComponent,
    TarifaCasosDialogComponent,
  ],
  templateUrl: './auditoria-estaciones-list.component.html',
  styleUrl: './auditoria-estaciones-list.component.css',
})
export class AuditoriaEstacionesListComponent implements OnInit, OnDestroy {
  private readonly filter$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  rows: AuditoriaEstacionRow[] = [];
  total = 0;
  loading = false;
  error: string | null = null;
  page = 1;
  pageSize = 50;
  sortKey = 'estacion_nombre';
  sortDirection: 'asc' | 'desc' = 'asc';
  estados: EstadoCasoAuditoriaEstacion[] = ['PENDIENTE'];
  peajeIds: string[] = [];
  empresaIds: string[] = [];
  q = '';

  peajes: Peaje[] = [];
  empresas: Empresa[] = [];
  estaciones: Estacion[] = [];

  expandedId: string | null = null;
  expandedRow: AuditoriaEstacionRow | null = null;
  panelError: string | null = null;
  saving = false;

  casosOpen = false;
  casosRows: PasadaGestion[] = [];
  casosTotal = 0;
  casosLoading = false;
  casosError: string | null = null;
  casosPage = 1;
  casosPageSize = 50;
  casosSort: DataTableSort = { key: 'fecha_hora', direction: 'desc' };
  casosEstacionId: string | null = null;

  previewOpen = false;
  preview: PreviewCorreccionEstacion | null = null;
  previewDestino = '';
  previewModalidad: 'SOLO_FUTUROS' | 'FUTUROS_E_HISTORICOS' = 'SOLO_FUTUROS';
  previewError: string | null = null;

  readonly statusQuickOptions = (Object.keys(ESTADO_LABELS) as EstadoCasoAuditoriaEstacion[]).map(
    (id) => ({ id, label: ESTADO_LABELS[id] }),
  );

  constructor(
    @Inject(PEAJES_CATALOGO_SERVICE) private readonly catalogo: PeajesCatalogoService,
    @Inject(PEAJES_AUDITORIA_ESTACIONES_SERVICE) private readonly auditoria: PeajesAuditoriaEstacionesService,
    @Inject(PEAJES_PASADAS_SERVICE) private readonly pasadas: PeajesPasadasService,
  ) {}

  get peajeOptions(): SearchMultiSelectOption[] {
    return this.peajes.map((p) => ({ id: p.id, label: p.nombre }));
  }

  get empresaOptions(): SearchMultiSelectOption[] {
    return this.empresas.map((e) => ({ id: e.id, label: e.nombre }));
  }

  get chips(): FilterChip[] {
    const chips: FilterChip[] = [];
    if (this.estados.length) {
      chips.push({ id: 'estados', label: `Estado: ${this.estados.map((e) => ESTADO_LABELS[e]).join(', ')}` });
    }
    if (this.peajeIds.length) chips.push({ id: 'peaje_ids', label: `Peajes: ${this.peajeIds.length}` });
    if (this.q) chips.push({ id: 'q', label: `Buscar: ${this.q}` });
    return chips;
  }

  get pageRangeLabel(): string {
    if (!this.total) return '0 filas';
    const from = (this.page - 1) * this.pageSize + 1;
    const to = Math.min(this.total, this.page * this.pageSize);
    return `${from}–${to} de ${this.total}`;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  ngOnInit(): void {
    this.filter$.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(() => {
      this.page = 1;
      void this.loadRows();
    });
    void this.bootstrap();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async bootstrap(): Promise<void> {
    const [peajes, empresas, estaciones] = await Promise.all([
      firstValueFrom(this.catalogo.listarPeajes()),
      firstValueFrom(this.catalogo.listarEmpresas()),
      firstValueFrom(this.catalogo.listarEstaciones()),
    ]);
    this.peajes = peajes;
    this.empresas = empresas;
    this.estaciones = estaciones;
    await this.loadRows();
  }

  async loadRows(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const result = await firstValueFrom(
        this.auditoria.listar({
          filters: {
            estados: this.estados.length ? this.estados : undefined,
            peaje_ids: this.peajeIds.length ? this.peajeIds : undefined,
            empresa_ids: this.empresaIds.length ? this.empresaIds : undefined,
            q: this.q || null,
          },
          page: this.page,
          pageSize: this.pageSize,
          sort: `${this.sortKey}:${this.sortDirection}`,
        }),
      );
      this.rows = result.rows;
      this.total = result.total;
    } catch {
      this.error = 'No se pudieron cargar las estaciones para auditar.';
      this.rows = [];
      this.total = 0;
    } finally {
      this.loading = false;
    }
  }

  emptyMessage(): string {
    if (this.loading) return 'Cargando estaciones…';
    return 'No hay estaciones para los filtros actuales.';
  }

  onQ(value: string): void {
    this.q = value;
    this.filter$.next(value);
  }

  onPeajes(ids: string[]): void {
    this.peajeIds = ids;
    this.page = 1;
    void this.loadRows();
  }

  onEmpresas(ids: string[]): void {
    this.empresaIds = ids;
    this.page = 1;
    void this.loadRows();
  }

  toggleStatusQuick(id: EstadoCasoAuditoriaEstacion): void {
    this.estados = this.estados.includes(id) ? this.estados.filter((e) => e !== id) : [...this.estados, id];
    this.page = 1;
    void this.loadRows();
  }

  isStatusQuickActive(id: EstadoCasoAuditoriaEstacion): boolean {
    return this.estados.includes(id);
  }

  clearFilters(): void {
    this.estados = [];
    this.peajeIds = [];
    this.empresaIds = [];
    this.q = '';
    this.page = 1;
    void this.loadRows();
  }

  removeChip(id: string): void {
    if (id === 'estados') this.estados = [];
    if (id === 'peaje_ids') this.peajeIds = [];
    if (id === 'q') this.q = '';
    this.page = 1;
    void this.loadRows();
  }

  onSort(key: string): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
    void this.loadRows();
  }

  ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    if (this.sortKey !== key) return 'none';
    return this.sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  goPage(page: number): void {
    this.page = page;
    void this.loadRows();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.page = 1;
    void this.loadRows();
  }

  trackByRowId(_: number, row: AuditoriaEstacionRow): string {
    return row.estacionId;
  }

  toggleExpand(row: AuditoriaEstacionRow): void {
    if (this.expandedId === row.estacionId) {
      this.expandedId = null;
      this.expandedRow = null;
      return;
    }
    this.expandedId = row.estacionId;
    this.expandedRow = row;
    this.panelError = null;
  }

  hallazgoLabel(code: string): string {
    return HALLAZGO_LABELS[code] ?? code;
  }

  estadoLabel(code: EstadoCasoAuditoriaEstacion): string {
    return ESTADO_LABELS[code];
  }

  muestraAlarma(row: AuditoriaEstacionRow): boolean {
    return row.hallazgos.includes('SECUENCIA_NUMERICA_CON_SALTO') || row.hallazgos.includes('SECUENCIA_NUMERICA_INVERTIDA');
  }

  async onConfirm(row: AuditoriaEstacionRow, payload: { estado: EstadoCasoAuditoriaEstacion; observacion: string | null }): Promise<void> {
    this.saving = true;
    this.panelError = null;
    try {
      await firstValueFrom(
        this.auditoria.transicionar(row.casoId, row.fingerprint, payload.estado, payload.observacion, row),
      );
      await this.loadRows();
    } catch (e) {
      this.panelError = e instanceof Error ? e.message : 'No se pudo guardar el estado.';
    } finally {
      this.saving = false;
    }
  }

  async openVerCasos(row: AuditoriaEstacionRow): Promise<void> {
    this.casosOpen = true;
    this.casosEstacionId = row.estacionId;
    this.casosPage = 1;
    await this.loadCasos();
  }

  closeCasos(): void {
    this.casosOpen = false;
  }

  async loadCasos(): Promise<void> {
    if (!this.casosEstacionId) return;
    this.casosLoading = true;
    this.casosError = null;
    try {
      const result = await firstValueFrom(
        this.pasadas.listar({
          filters: { estacion_ids: [this.casosEstacionId] },
          sort: this.casosSort.key,
          dir: this.casosSort.direction,
          limit: this.casosPageSize,
          offset: (this.casosPage - 1) * this.casosPageSize,
        }),
      );
      this.casosRows = result.rows;
      this.casosTotal = result.total;
    } catch {
      this.casosError = 'No se pudieron cargar las pasadas.';
      this.casosRows = [];
      this.casosTotal = 0;
    } finally {
      this.casosLoading = false;
    }
  }

  onCasosSort(sort: DataTableSort): void {
    this.casosSort = sort;
    void this.loadCasos();
  }

  onCasosPage(page: DataTablePageChange): void {
    this.casosPage = page.page;
    this.casosPageSize = page.pageSize;
    void this.loadCasos();
  }

  async openCorregir(row: AuditoriaEstacionRow): Promise<void> {
    this.previewDestino = this.estaciones.find((e) => e.peaje_id === row.peajeId && e.id !== row.estacionId)?.id ?? row.estacionId;
    this.previewError = null;
    try {
      const casoId = row.casoId;
      if (!casoId) {
        const created = await firstValueFrom(
          this.auditoria.transicionar(null, row.fingerprint, 'REQUIERE_CORRECCION', row.observacion, row),
        );
        row.casoId = created.casoId;
      }
      this.preview = await firstValueFrom(this.auditoria.previsualizar(row.casoId!, this.previewDestino));
      this.previewOpen = true;
    } catch (e) {
      this.panelError = e instanceof Error ? e.message : 'No se pudo previsualizar.';
    }
  }

  async confirmPreview(): Promise<void> {
    if (!this.preview || !this.expandedRow) return;
    this.previewError = null;
    try {
      await firstValueFrom(
        this.auditoria.corregir({
          casoId: this.preview.casoId,
          estacionDestinoId: this.preview.estacionDestinoId,
          modalidad: this.previewModalidad,
          previewHash: this.preview.previewHash,
        }),
      );
      this.previewOpen = false;
      await this.loadRows();
    } catch (e) {
      this.previewError = e instanceof Error ? e.message : 'No se pudo corregir.';
    }
  }
}
