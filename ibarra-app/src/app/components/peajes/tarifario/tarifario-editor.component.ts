import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DateRangePickerComponent, toDateInputValue, type DateRangeValue } from '../../shared';
import {
  PEAJES_TARIFARIO_SERVICE,
  PeajesTarifarioService,
  TarifaSentido,
  TarifaStatusPico,
  TarifarioEditorDrafts,
  TarifarioEditorPayload,
  TarifarioEditorRow,
  TarifarioHistorialItem,
  TarifarioIdentidadExistente,
  TarifarioCategoriaEstadoCambio,
} from '../models/tarifario.contracts';
import {
  TarifarioDraftChange,
  TarifarioCategoryStateChange,
  TarifarioEditorBoardComponent,
} from './tarifario-editor-board.component';
import { TarifarioHistorialDialogComponent } from './tarifario-historial-dialog.component';
import {
  MISSING_IMPORTE_LABEL,
  TARIFARIO_CATEGORIAS_MAX,
  buildEditorRows,
  categoriasEditor,
  collectCambios,
  collectDraftErrores,
  countCategoriasEditor,
  formatFechaActualizacion,
  formatTarifaImporteDisplay,
  isTarifaSentido,
} from './tarifario.helpers';
import { nextCategoryAction, type CategoryAction } from './tarifario-groups.helpers';

@Component({
  selector: 'app-tarifario-editor',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DateRangePickerComponent,
    TarifarioEditorBoardComponent,
    TarifarioHistorialDialogComponent,
  ],
  templateUrl: './tarifario-editor.component.html',
  styleUrls: ['../shared/peajes-list-shell.css', './tarifario-editor.component.css'],
})
export class TarifarioEditorComponent implements OnInit {
  readonly missing = MISSING_IMPORTE_LABEL;
  readonly categoriasMax = TARIFARIO_CATEGORIAS_MAX;

  loading = true;
  saving = false;
  error: string | null = null;
  saveError: string | null = null;
  peajeNombre = '';
  estacionNombre = '';
  sentido: TarifaSentido | null = null;
  peajeId = '';
  estacionId = '';
  rows: TarifarioEditorRow[] = [];
  drafts: TarifarioEditorDrafts = {};
  private existentes: TarifarioIdentidadExistente[] = [];
  categoriaCount = 0;
  addedDraftCategories: number[] = [];

  historyOpen = false;
  historyTitle = '';
  historyLoading = false;
  historyError: string | null = null;
  historyRows: TarifarioHistorialItem[] = [];
  vigenteDesde: DateRangeValue = { from: null, to: null };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    @Inject(PEAJES_TARIFARIO_SERVICE) private readonly tarifario: PeajesTarifarioService,
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  get breadcrumb(): string {
    if (!this.sentido) return '';
    return `${this.peajeNombre}  >  ${this.estacionNombre}  >  ${this.sentido}`;
  }

  get ultimaActualizacion(): string {
    const stamps = this.rows.flatMap((row) => [
      row.no_pico.fecha_actualizacion,
      row.pico.fecha_actualizacion,
    ]).filter((iso): iso is string => !!iso);
    if (!stamps.length) return this.missing;
    return formatFechaActualizacion(stamps.reduce((latest, iso) => (iso > latest ? iso : latest)));
  }

  get canSave(): boolean {
    return (
      collectCambios(this.rows, this.drafts).length > 0 &&
      collectDraftErrores(this.rows, this.drafts).length === 0 &&
      !this.saving
    );
  }

  async load(): Promise<void> {
    const peajeId = this.route.snapshot.paramMap.get('peajeId') ?? '';
    const estacionId = this.route.snapshot.paramMap.get('estacionId') ?? '';
    const sentidoRaw = this.route.snapshot.paramMap.get('sentido') ?? '';
    if (!peajeId || !estacionId || !isTarifaSentido(sentidoRaw)) {
      await this.router.navigate(['/peajes/tarifario']);
      return;
    }
    this.peajeId = peajeId;
    this.estacionId = estacionId;
    this.sentido = sentidoRaw;
    this.categoriaCount = 0;
    this.addedDraftCategories = [];
    this.drafts = {};
    this.loading = true;
    this.error = null;
    try {
      this.applyEditorPayload(
        await firstValueFrom(this.tarifario.obtenerEditor(peajeId, estacionId, sentidoRaw)),
      );
    } catch {
      this.error = 'No se pudo cargar el tarifario de esta estación.';
      this.rows = [];
    } finally {
      this.loading = false;
    }
  }

  get canAddCategoria(): boolean {
    return !this.loading && this.nextCategory.action !== 'NONE';
  }

  get nextCategory(): CategoryAction {
    return nextCategoryAction(this.categoryIdentities(), TARIFARIO_CATEGORIAS_MAX, this.draftCategories());
  }

  private applyEditorPayload(payload: TarifarioEditorPayload): void {
    this.peajeNombre = payload.context.peaje_nombre;
    this.estacionNombre = payload.context.estacion_nombre;
    this.existentes = payload.existentes;
    this.categoriaCount = Math.max(
      this.categoriaCount,
      countCategoriasEditor(payload.existentes),
    );
    this.rebuildRows();
  }

  private rebuildRows(): void {
    this.rows = buildEditorRows(this.existentes, categoriasEditor(this.categoriaCount));
    const drafts: TarifarioEditorDrafts = { ...this.drafts };
    for (const row of this.rows) {
      if (!drafts[row.categoria]) {
        drafts[row.categoria] = { no_pico: '', pico: '' };
      }
    }
    this.drafts = drafts;
  }

  displayActual(value: number | null): string {
    return formatTarifaImporteDisplay(value);
  }

  displayFecha(iso: string | null | undefined): string {
    return formatFechaActualizacion(iso);
  }

  async addCategoria(): Promise<void> {
    if (!this.canAddCategoria) return;
    const next = this.nextCategory;
    if (next.action === 'ENABLE' && this.sentido) {
      try {
        await firstValueFrom(this.tarifario.actualizarEstadoCategorias([{
          peajeId: this.peajeId,
          estacionId: this.estacionId,
          sentido: this.sentido,
          categoria: next.categoria,
          enabled: true,
        }]));
        await this.load();
      } catch {
        this.saveError = 'No se pudo habilitar la categoría existente.';
      }
      return;
    }
    if (next.action !== 'DRAFT') return;
    this.addedDraftCategories = [...new Set([...this.addedDraftCategories, next.categoria])];
    this.categoriaCount = Math.max(this.categoriaCount, next.categoria);
    this.rebuildRows();
  }

  onDraftChange(change: TarifarioDraftChange): void {
    this.setDraft(change.categoria, change.status, change.value);
  }

  setDraft(categoria: number, status: TarifaStatusPico, value: string): void {
    const current = this.drafts[categoria] ?? { no_pico: '', pico: '' };
    this.drafts = {
      ...this.drafts,
      [categoria]:
        status === 'NO_PICO'
          ? { ...current, no_pico: value }
          : { ...current, pico: value },
    };
  }

  cancel(): void {
    void this.router.navigate(['/peajes/tarifario']);
  }

  onVigenteDesde(value: DateRangeValue): void {
    this.vigenteDesde = { from: value.from, to: null };
  }

  async save(): Promise<void> {
    if (!this.sentido) return;
    const errores = collectDraftErrores(this.rows, this.drafts);
    if (errores.length) {
      this.saveError = 'Hay importes inválidos. Corregilos antes de guardar.';
      return;
    }
    const cambios = collectCambios(this.rows, this.drafts);
    if (!cambios.length) return;
    const fechaIso = toDateInputValue(this.vigenteDesde.from);
    if (!fechaIso) {
      this.saveError = 'Indicá la fecha de Vigente desde para confirmar tarifas nuevas.';
      return;
    }
    this.saving = true;
    this.saveError = null;
    try {
      await firstValueFrom(
        this.tarifario.guardar(
          this.peajeId,
          this.estacionId,
          this.sentido,
          cambios.map((cambio) => ({ ...cambio, fechaVigenciaInicio: fechaIso })),
        ),
      );
      this.drafts = {};
      this.applyEditorPayload(
        await firstValueFrom(
          this.tarifario.obtenerEditor(this.peajeId, this.estacionId, this.sentido),
        ),
      );
    } catch {
      this.saveError = 'No se pudieron guardar los cambios. Reintentá.';
    } finally {
      this.saving = false;
    }
  }

  async onCategoryStateChange(change: TarifarioCategoryStateChange): Promise<void> {
    if (!this.sentido) return;
    const payload: TarifarioCategoriaEstadoCambio = {
      peajeId: this.peajeId,
      estacionId: this.estacionId,
      sentido: this.sentido,
      categoria: change.categoria,
      enabled: change.enabled,
    };
    try {
      await firstValueFrom(this.tarifario.actualizarEstadoCategorias([payload]));
      await this.load();
    } catch {
      this.saveError = 'No se pudo actualizar el estado de la categoría. El valor anterior se conserva.';
    }
  }

  private categoryIdentities() {
    return this.rows.flatMap((row) => [row.no_pico, row.pico].map((cell) => ({
      categoria: row.categoria,
      enabled: cell.enabled !== false,
      tarifaId: cell.tarifa_id,
    })));
  }

  private draftCategories(): number[] {
    return this.addedDraftCategories;
  }

  async openHistory(row: TarifarioEditorRow, status: TarifaStatusPico): Promise<void> {
    const cell = status === 'NO_PICO' ? row.no_pico : row.pico;
    if (!cell.tarifa_id) return;
    this.historyTitle = `Cat. ${row.categoria} · ${status}`;
    this.historyOpen = true;
    this.historyLoading = true;
    this.historyError = null;
    try {
      this.historyRows = await firstValueFrom(this.tarifario.listarHistorial(cell.tarifa_id));
    } catch {
      this.historyError = 'No se pudo cargar el historial.';
      this.historyRows = [];
    } finally {
      this.historyLoading = false;
    }
  }
}
