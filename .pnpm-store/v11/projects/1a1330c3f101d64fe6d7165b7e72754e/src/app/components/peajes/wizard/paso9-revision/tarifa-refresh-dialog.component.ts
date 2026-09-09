import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Inject, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CheckboxMultiSelectComponent, DialogComponent } from '../../../shared';
import type { CheckboxMultiSelectOption } from '../../../shared';
import {
  CandidatoRefrescoTarifa,
  ResultadoDetectarRefresco,
  TARIFA_REFRESH_SERVICE,
  TarifaRefreshService,
} from '../../models/tarifa-refresh.contracts';
import {
  CambioRefrescoTarifa,
  PEAJES_TARIFARIO_SERVICE,
  PeajesTarifarioService,
  TarifaSentido,
  TarifaStatusPico,
  TarifarioEditorDrafts,
  TarifarioEditorRow,
  TarifarioHistorialItem,
  TarifaRefrescoGuardada,
} from '../../models/tarifario.contracts';
import {
  TarifarioDetectedMap,
  TarifarioDraftChange,
  TarifarioEditorBoardComponent,
  TarifarioHistoryRequest,
  detectedCellKey,
} from '../../tarifario/tarifario-editor-board.component';
import { TarifarioHistorialDialogComponent } from '../../tarifario/tarifario-historial-dialog.component';
import {
  buildEditorRows,
  categoriasEditor,
  collectCambios,
  collectDraftErrores,
  countCategoriasEditor,
} from '../../tarifario/tarifario.helpers';
import {
  agruparPendientesPorPeajeYFamilia,
  familySentidos,
  heuristicaSeleccionInicial,
  interseccionSentidos,
  resolverRequiereNormalizacionIva,
  type EstacionCatalogoRefresco,
  type EstacionOpcionRefresco,
  type IdentidadTarifaExistente,
  type SentidoFamily,
} from './tarifa-refresh-dialog.helpers';

export interface TablaSentidoRefresco {
  sentido: TarifaSentido;
  rows: TarifarioEditorRow[];
  drafts: TarifarioEditorDrafts;
  detected: TarifarioDetectedMap;
}

export interface GrupoTarifaRefresco {
  key: string;
  peajeId: string;
  peajeNombre: string;
  family: SentidoFamily;
  opciones: EstacionOpcionRefresco[];
  seleccionadas: string[];
  anchorEstacionId: string;
  tablas: TablaSentidoRefresco[];
  itemsPorEstacion: Map<string, ResultadoDetectarRefresco[]>;
  existentes: IdentidadTarifaExistente[];
}

const BLOQUEANTES: ReadonlySet<string> = new Set([
  'NEW_TARIFF',
  'STATUS_REQUIRED',
  'STATUS_AMBIGUOUS',
  'DIRECTION_REQUIRED',
  'DIRECTION_CONFLICT',
]);

@Component({
  selector: 'app-tarifa-refresh-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DialogComponent,
    CheckboxMultiSelectComponent,
    TarifarioEditorBoardComponent,
    TarifarioHistorialDialogComponent,
  ],
  templateUrl: './tarifa-refresh-dialog.component.html',
  styleUrls: [
    '../../shared/peajes-list-shell.css',
    '../../tarifario/tarifario-editor.component.css',
    './tarifa-refresh-dialog.component.css',
  ],
})
export class TarifaRefreshDialogComponent implements OnInit, OnChanges {
  @Input() open = false;
  @Input() resultados: ResultadoDetectarRefresco[] = [];
  @Input() candidatos: CandidatoRefrescoTarifa[] = [];
  @Input() canManage = true;
  @Input() saving = false;

  @Output() openChange = new EventEmitter<boolean>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() saved = new EventEmitter<TarifaRefrescoGuardada[]>();

  grupos: GrupoTarifaRefresco[] = [];
  loading = false;
  error: string | null = null;

  historyOpen = false;
  historyTitle = '';
  historyLoading = false;
  historyError: string | null = null;
  historyRows: TarifarioHistorialItem[] = [];

  constructor(
    @Inject(PEAJES_TARIFARIO_SERVICE) private readonly tarifario: PeajesTarifarioService,
    @Inject(TARIFA_REFRESH_SERVICE) private readonly refresh: TarifaRefreshService,
  ) {}

  ngOnInit(): void {
    this.reloadIfOpen();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['resultados'] || changes['candidatos']) {
      this.reloadIfOpen();
    }
  }

  get unresolved(): ResultadoDetectarRefresco[] {
    return this.resultados.filter((r) => BLOQUEANTES.has(r.codigo));
  }

  familyLabel(family: SentidoFamily): string {
    if (family === 'AMBAS') return 'AMBAS';
    if (family === 'DIRECCIONAL') return 'IDA y VUELTA';
    return '';
  }

  checkboxOptions(grupo: GrupoTarifaRefresco): CheckboxMultiSelectOption[] {
    return grupo.opciones.map((opcion) => ({
      value: opcion.estacionId,
      label: opcion.estacionNombre,
    }));
  }

  anchorNombre(grupo: GrupoTarifaRefresco): string {
    return (
      grupo.opciones.find((opcion) => opcion.estacionId === grupo.anchorEstacionId)?.estacionNombre ??
      grupo.anchorEstacionId
    );
  }

  close(): void {
    this.openChange.emit(false);
    this.cancelled.emit();
  }

  onDraft(grupo: GrupoTarifaRefresco, tabla: TablaSentidoRefresco, change: TarifarioDraftChange): void {
    const current = tabla.drafts[change.categoria] ?? { no_pico: '', pico: '' };
    tabla.drafts = {
      ...tabla.drafts,
      [change.categoria]:
        change.status === 'NO_PICO'
          ? { ...current, no_pico: change.value }
          : { ...current, pico: change.value },
    };
  }

  async onSeleccionChange(grupo: GrupoTarifaRefresco, next: string[]): Promise<void> {
    const valid = next.filter((id) => grupo.opciones.some((opcion) => opcion.estacionId === id));
    if (!valid.length) return;
    grupo.seleccionadas = valid;
    grupo.anchorEstacionId = valid[0];
    await this.loadTablas(grupo);
  }

  async guardar(): Promise<void> {
    if (!this.canManage) return;
    this.error = null;
    const cambios: CambioRefrescoTarifa[] = [];
    for (const grupo of this.grupos) {
      if (grupo.family === 'SIN_TARIFARIO') {
        this.error = 'No hay un tarifario cargado para esta estación. No se puede crear un sentido desde la carga.';
        return;
      }
      if (!grupo.seleccionadas.length || !grupo.tablas.length) {
        this.error = 'Elegí al menos una estación con un sentido existente del tarifario.';
        return;
      }
      for (const tabla of grupo.tablas) {
        const errores = collectDraftErrores(tabla.rows, tabla.drafts);
        if (errores.length) {
          this.error = 'Hay importes inválidos. Corregilos antes de guardar.';
          return;
        }
        for (const cambio of collectCambios(tabla.rows, tabla.drafts)) {
          for (const estacionId of grupo.seleccionadas) {
            cambios.push({
              peajeId: grupo.peajeId,
              estacionId,
              sentido: tabla.sentido,
              categoria: cambio.categoria,
              status: cambio.status,
              importe: cambio.importe,
              cases: 0,
              requiereNormalizacionIva: resolverRequiereNormalizacionIva(
                estacionId,
                cambio.categoria,
                cambio.status,
                tabla.sentido,
                grupo.existentes,
              ),
            });
          }
        }
      }
    }
    if (!cambios.length) return;
    this.saving = true;
    try {
      const saved = await this.refresh.guardar(cambios);
      this.saved.emit(saved);
      this.openChange.emit(false);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'No se pudieron guardar los cambios.';
    } finally {
      this.saving = false;
    }
  }

  async openHistory(
    grupo: GrupoTarifaRefresco,
    tabla: TablaSentidoRefresco,
    request: TarifarioHistoryRequest,
  ): Promise<void> {
    const cell = request.status === 'NO_PICO' ? request.row.no_pico : request.row.pico;
    if (!cell.tarifa_id) return;
    this.historyTitle = `${this.anchorNombre(grupo)} · ${tabla.sentido} · Cat. ${request.row.categoria} · ${request.status}`;
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

  private reloadIfOpen(): void {
    if (!this.open) return;
    void this.loadGrupos();
  }

  private async loadGrupos(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const byPeaje = new Map<string, ResultadoDetectarRefresco[]>();
      for (const item of this.unresolved) {
        const key = item.peajeId ?? '';
        const list = byPeaje.get(key) ?? [];
        list.push(item);
        byPeaje.set(key, list);
      }
      const grupos: GrupoTarifaRefresco[] = [];
      for (const [peajeId, items] of byPeaje) {
        const listed = await firstValueFrom(
          this.tarifario.listar({
            filters: peajeId
              ? { peaje_ids: [peajeId] }
              : { estacion_ids: [...new Set(items.map((item) => item.estacionId))] },
            page: 1,
            pageSize: 500,
          }),
        );
        const catalogo = this.catalogoDesdeListado(listed.rows, peajeId, items);
        const existentes: IdentidadTarifaExistente[] = listed.rows.map((row) => ({
          estacionId: row.estacion_id,
          categoria: row.categoria,
          status: row.status,
          sentido: row.sentido,
        }));
        for (const pending of agruparPendientesPorPeajeYFamilia(items, catalogo)) {
          const seleccionadas = heuristicaSeleccionInicial(pending, this.candidatos);
          const grupo: GrupoTarifaRefresco = {
            ...pending,
            seleccionadas,
            anchorEstacionId: seleccionadas[0] ?? pending.opciones[0]?.estacionId ?? '',
            tablas: [],
            existentes,
          };
          await this.loadTablas(grupo);
          grupos.push(grupo);
        }
      }
      this.grupos = grupos;
    } catch (e) {
      this.grupos = [];
      this.error = e instanceof Error ? e.message : 'No se pudo cargar el tarifario de esta estación.';
    } finally {
      this.loading = false;
    }
  }

  private catalogoDesdeListado(
    rows: Array<{
      estacion_id: string;
      estacion_nombre: string;
      peaje_id: string;
      peaje_nombre: string | null;
      sentido: TarifaSentido;
    }>,
    peajeId: string,
    items: ResultadoDetectarRefresco[],
  ): EstacionCatalogoRefresco[] {
    const byEstacion = new Map<string, EstacionCatalogoRefresco>();
    for (const row of rows) {
      const existing = byEstacion.get(row.estacion_id);
      if (!existing) {
        byEstacion.set(row.estacion_id, {
          estacionId: row.estacion_id,
          estacionNombre: row.estacion_nombre,
          peajeId: row.peaje_id,
          peajeNombre: row.peaje_nombre ?? '',
          sentidosExistentes: [row.sentido],
        });
      } else if (!existing.sentidosExistentes.includes(row.sentido)) {
        existing.sentidosExistentes.push(row.sentido);
      }
    }
    for (const item of items) {
      if (byEstacion.has(item.estacionId)) continue;
      byEstacion.set(item.estacionId, {
        estacionId: item.estacionId,
        estacionNombre: item.estacionId,
        peajeId: peajeId || item.peajeId || '',
        peajeNombre: [...byEstacion.values()][0]?.peajeNombre ?? '',
        sentidosExistentes: [],
      });
    }
    return [...byEstacion.values()];
  }

  private async loadTablas(grupo: GrupoTarifaRefresco): Promise<void> {
    if (grupo.family === 'SIN_TARIFARIO' || !grupo.anchorEstacionId || !grupo.peajeId) {
      grupo.tablas = [];
      return;
    }
    const selected = grupo.opciones.filter((opcion) => grupo.seleccionadas.includes(opcion.estacionId));
    const sentidos = familySentidos(
      grupo.family,
      interseccionSentidos(selected.map((opcion) => opcion.sentidosExistentes)),
    );
    const previous = new Map(grupo.tablas.map((tabla) => [tabla.sentido, tabla.drafts]));
    const items = grupo.seleccionadas.flatMap((id) => grupo.itemsPorEstacion.get(id) ?? []);
    const tablas: TablaSentidoRefresco[] = [];
    for (const sentido of sentidos) {
      let rows: TarifarioEditorRow[] = [];
      try {
        const editor = await firstValueFrom(
          this.tarifario.obtenerEditor(grupo.peajeId, grupo.anchorEstacionId, sentido),
        );
        grupo.peajeNombre = editor.context.peaje_nombre || grupo.peajeNombre;
        const cats = Math.max(
          countCategoriasEditor(editor.existentes),
          ...items.map((item) => item.categoria ?? 0),
        );
        rows = buildEditorRows(editor.existentes, categoriasEditor(cats || 1));
      } catch {
        rows = buildEditorRows(
          [],
          categoriasEditor(Math.max(...items.map((item) => item.categoria ?? 1), 1)),
        );
      }
      const drafts: TarifarioEditorDrafts = { ...(previous.get(sentido) ?? {}) };
      const detected: TarifarioDetectedMap = {};
      for (const row of rows) {
        drafts[row.categoria] ??= { no_pico: '', pico: '' };
      }
      for (const item of items) {
        if (item.categoria == null) continue;
        const itemSentido = item.sentidoAplicado ?? item.sentidoSolicitado;
        if (itemSentido && itemSentido !== sentido) continue;
        const amounts = this.detectedAmounts(item);
        const statuses: TarifaStatusPico[] = item.status ? [item.status] : ['NO_PICO', 'PICO'];
        for (const status of statuses) {
          const key = detectedCellKey(item.categoria, status);
          detected[key] = [...(detected[key] ?? []), ...amounts];
        }
        if (
          amounts.length === 1 &&
          item.status &&
          item.codigo === 'NEW_TARIFF' &&
          (grupo.family === 'AMBAS' || itemSentido === sentido)
        ) {
          const current = drafts[item.categoria] ?? { no_pico: '', pico: '' };
          if (item.status === 'NO_PICO' && !current.no_pico) {
            drafts[item.categoria] = { ...current, no_pico: String(amounts[0].valor) };
          } else if (item.status === 'PICO' && !current.pico) {
            drafts[item.categoria] = { ...current, pico: String(amounts[0].valor) };
          }
        }
      }
      tablas.push({ sentido, rows, drafts, detected });
    }
    grupo.tablas = tablas;
  }

  private detectedAmounts(item: ResultadoDetectarRefresco): Array<{ valor: number; count: number }> {
    const related = this.candidatos.filter((c) =>
      c.rowIndexes.some((idx) => item.rowIndexes.includes(idx)),
    );
    const counts = new Map<number, number>();
    for (const c of related) {
      counts.set(c.precioDirecto, (counts.get(c.precioDirecto) ?? 0) + c.rowIndexes.length);
    }
    if (!counts.size && item.candidatePrice) {
      return [{ valor: item.candidatePrice, count: item.rowIndexes.length }];
    }
    return [...counts.entries()].map(([valor, count]) => ({ valor, count }));
  }
}
