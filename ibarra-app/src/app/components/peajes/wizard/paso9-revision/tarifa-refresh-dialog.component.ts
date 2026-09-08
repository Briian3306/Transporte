import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Inject, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { DialogComponent } from '../../../shared/dialog/dialog.component';
import {
  CandidatoRefrescoTarifa,
  ResultadoDetectarRefresco,
} from '../../models/tarifa-refresh.contracts';
import {
  CambioRefrescoTarifa,
  PEAJES_TARIFARIO_SERVICE,
  PeajesTarifarioService,
  TarifaSentido,
  TarifaStatusPico,
  TarifarioEditorDrafts,
  TarifarioEditorRow,
  TarifaRefrescoGuardada,
} from '../../models/tarifario.contracts';
import {
  TARIFA_REFRESH_SERVICE,
  TarifaRefreshService,
} from '../../models/tarifa-refresh.contracts';
import {
  TarifarioDetectedMap,
  TarifarioDraftChange,
  TarifarioEditorBoardComponent,
  detectedCellKey,
} from '../../tarifario/tarifario-editor-board.component';
import {
  buildEditorRows,
  categoriasEditor,
  collectCambios,
  collectDraftErrores,
  countCategoriasEditor,
} from '../../tarifario/tarifario.helpers';

interface SeccionRefresco {
  key: string;
  peajeId: string;
  estacionId: string;
  estacionNombre: string;
  sentido: TarifaSentido;
  rows: TarifarioEditorRow[];
  drafts: TarifarioEditorDrafts;
  detected: TarifarioDetectedMap;
  ivaNuevo: Record<string, boolean | null>;
}

const BLOQUEANTES: ReadonlySet<string> = new Set([
  'NEW_TARIFF',
  'STATUS_REQUIRED',
  'STATUS_AMBIGUOUS',
]);

@Component({
  selector: 'app-tarifa-refresh-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogComponent, TarifarioEditorBoardComponent],
  templateUrl: './tarifa-refresh-dialog.component.html',
  styleUrl: './tarifa-refresh-dialog.component.css',
})
export class TarifaRefreshDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() resultados: ResultadoDetectarRefresco[] = [];
  @Input() candidatos: CandidatoRefrescoTarifa[] = [];
  @Input() canManage = true;
  @Input() saving = false;

  @Output() openChange = new EventEmitter<boolean>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() saved = new EventEmitter<TarifaRefrescoGuardada[]>();

  secciones: SeccionRefresco[] = [];
  error: string | null = null;
  cellErrors: Record<string, string> = {};
  statusChoice: Record<string, TarifaStatusPico | ''> = {};

  constructor(
    @Inject(PEAJES_TARIFARIO_SERVICE) private readonly tarifario: PeajesTarifarioService,
    @Inject(TARIFA_REFRESH_SERVICE) private readonly refresh: TarifaRefreshService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      void this.loadSecciones();
    }
  }

  get unresolved(): ResultadoDetectarRefresco[] {
    return this.resultados.filter((r) => BLOQUEANTES.has(r.codigo));
  }

  close(): void {
    this.openChange.emit(false);
    this.cancelled.emit();
  }

  onDraft(seccion: SeccionRefresco, change: TarifarioDraftChange): void {
    const current = seccion.drafts[change.categoria] ?? { no_pico: '', pico: '' };
    seccion.drafts = {
      ...seccion.drafts,
      [change.categoria]:
        change.status === 'NO_PICO'
          ? { ...current, no_pico: change.value }
          : { ...current, pico: change.value },
    };
  }

  async guardar(): Promise<void> {
    if (!this.canManage) return;
    this.error = null;
    this.cellErrors = {};
    const cambios: CambioRefrescoTarifa[] = [];
    for (const seccion of this.secciones) {
      const errores = collectDraftErrores(seccion.rows, seccion.drafts);
      if (errores.length) {
        this.error = 'Hay importes inválidos. Corregilos antes de guardar.';
        return;
      }
      for (const cambio of collectCambios(seccion.rows, seccion.drafts)) {
        const row = seccion.rows.find((r) => r.categoria === cambio.categoria);
        const cell = cambio.status === 'NO_PICO' ? row?.no_pico : row?.pico;
        const ivaKey = `${cambio.categoria}:${cambio.status}`;
        let iva: boolean | null = null;
        if (!cell?.tarifa_id) {
          const chosen = seccion.ivaNuevo[ivaKey];
          if (chosen == null) {
            this.error = 'Elegí si la identidad nueva requiere normalización de IVA.';
            return;
          }
          iva = chosen;
        }
        cambios.push({
          peajeId: seccion.peajeId,
          estacionId: seccion.estacionId,
          sentido: seccion.sentido,
          categoria: cambio.categoria,
          status: cambio.status,
          importe: cambio.importe,
          requiereNormalizacionIva: iva,
        });
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

  private async loadSecciones(): Promise<void> {
    const groups = new Map<string, ResultadoDetectarRefresco[]>();
    for (const r of this.unresolved) {
      const sentido = r.sentidoAplicado ?? r.sentidoSolicitado;
      const key = `${r.peajeId ?? ''}|${r.estacionId}|${sentido}`;
      const list = groups.get(key) ?? [];
      list.push(r);
      groups.set(key, list);
    }
    const secciones: SeccionRefresco[] = [];
    for (const [key, items] of groups) {
      const first = items[0];
      const sentido = (first.sentidoAplicado ?? first.sentidoSolicitado) as TarifaSentido;
      const peajeId = first.peajeId ?? '';
      let rows: TarifarioEditorRow[] = [];
      let estacionNombre = first.estacionId;
      if (peajeId) {
        try {
          const editor = await firstValueFrom(
            this.tarifario.obtenerEditor(peajeId, first.estacionId, sentido),
          );
          estacionNombre = editor.context.estacion_nombre;
          const cats = Math.max(
            countCategoriasEditor(editor.existentes),
            ...items.map((i) => i.categoria ?? 0),
          );
          rows = buildEditorRows(editor.existentes, categoriasEditor(cats || 1));
        } catch {
          rows = buildEditorRows([], categoriasEditor(Math.max(...items.map((i) => i.categoria ?? 1), 1)));
        }
      }
      const drafts: TarifarioEditorDrafts = {};
      const detected: TarifarioDetectedMap = {};
      const ivaNuevo: Record<string, boolean | null> = {};
      for (const row of rows) {
        drafts[row.categoria] = { no_pico: '', pico: '' };
      }
      for (const item of items) {
        if (item.categoria == null) continue;
        const amounts = this.detectedAmounts(item);
        const status = item.status ?? this.uniqueStatus(item);
        if (status) {
          const mapKey = detectedCellKey(item.categoria, status);
          detected[mapKey] = amounts;
          if (amounts.length === 1 && item.codigo === 'NEW_TARIFF') {
            const current = drafts[item.categoria] ?? { no_pico: '', pico: '' };
            drafts[item.categoria] =
              status === 'NO_PICO'
                ? { ...current, no_pico: String(amounts[0].valor) }
                : { ...current, pico: String(amounts[0].valor) };
          }
        }
      }
      secciones.push({
        key,
        peajeId,
        estacionId: first.estacionId,
        estacionNombre,
        sentido,
        rows,
        drafts,
        detected,
        ivaNuevo,
      });
    }
    this.secciones = secciones;
  }

  private detectedAmounts(item: ResultadoDetectarRefresco): Array<{ valor: number; count: number }> {
    const related = this.candidatos.filter((c) =>
      c.rowIndexes.some((idx) => item.rowIndexes.includes(idx)),
    );
    const counts = new Map<number, number>();
    for (const c of related.length ? related : []) {
      counts.set(c.precioDirecto, (counts.get(c.precioDirecto) ?? 0) + c.rowIndexes.length);
    }
    if (!counts.size) {
      return [{ valor: 0, count: item.rowIndexes.length }];
    }
    return [...counts.entries()].map(([valor, count]) => ({ valor, count }));
  }

  private uniqueStatus(item: ResultadoDetectarRefresco): TarifaStatusPico | null {
    if (item.status) return item.status;
    return this.statusChoice[item.id] || null;
  }
}
