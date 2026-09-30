import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Inject, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { DateRangePickerComponent, toDateInputValue, type DateRangeValue } from '../../shared';
import {
  PEAJES_TARIFARIO_SERVICE,
  PeajesTarifarioService,
  TarifaSentido,
  TarifarioCategoriaEstadoCambio,
  TarifarioEditorDrafts,
  TarifarioEditorRow,
  TarifarioGroupChange,
  TarifarioStationGroup,
} from '../models/tarifario.contracts';
import { TarifarioEditorBoardComponent, type TarifarioCategoryStateChange, type TarifarioDraftChange } from './tarifario-editor-board.component';
import { buildEditorRows, collectCambios, collectDraftErrores, countCategoriasEditor, categoriasEditor } from './tarifario.helpers';
import { addTariffGroup, nextCategoryAction, removeStationFromTariffGroup, type CategoryAction, type TarifarioGroupStation } from './tarifario-groups.helpers';

export type TarifarioManageMode = 'manual' | 'refresh';

interface ManageGroup extends TarifarioStationGroup {
  peajeId: string;
  rows: TarifarioEditorRow[];
  drafts: TarifarioEditorDrafts;
  addedDraftCategories: number[];
  loading: boolean;
  error: string | null;
}

@Component({
  selector: 'app-tarifario-manage-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DateRangePickerComponent, TarifarioEditorBoardComponent],
  templateUrl: './tarifario-manage-dialog.component.html',
  styleUrls: ['./tarifario-manage-dialog.component.css'],
})
export class TarifarioManageDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() mode: TarifarioManageMode = 'manual';
  @Input() peajes: Array<{ id: string; nombre: string }> = [];
  @Input() stations: TarifarioGroupStation[] = [];
  @Input() initialPeajeId = '';
  @Input() initialEstacionId = '';
  @Input() initialSentido: TarifaSentido = 'AMBAS';
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<void>();

  groups: ManageGroup[] = [];
  selectedStationIds: string[] = [];
  selectedFamily: 'AMBAS' | 'DIRECCIONAL' = 'AMBAS';
  peajeId = '';
  vigenteDesde: DateRangeValue = { from: null, to: null };
  saving = false;
  error: string | null = null;

  constructor(@Inject(PEAJES_TARIFARIO_SERVICE) private readonly tarifario: PeajesTarifarioService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (this.open && (changes['open']?.currentValue === true || changes['initialEstacionId'] || changes['initialPeajeId'])) {
      void this.openSession();
    }
  }

  get availableStations(): TarifarioGroupStation[] {
    const used = new Set(this.groups.flatMap((group) => group.stationIds));
    return this.stations.filter((station) => station.peajeId === this.peajeId && !used.has(station.id));
  }

  trackGroup(_index: number, group: TarifarioStationGroup): string { return group.id; }

  stationName(stationId: string): string {
    return this.stations.find((station) => station.id === stationId)?.name ?? stationId;
  }

  toggleStation(stationId: string, checked: boolean): void {
    this.selectedStationIds = checked
      ? [...new Set([...this.selectedStationIds, stationId])]
      : this.selectedStationIds.filter((id) => id !== stationId);
  }

  get canSave(): boolean {
    return !this.saving && !!toDateInputValue(this.vigenteDesde.from)
      && this.groups.some((group) => collectCambios(group.rows, group.drafts).length > 0)
      && this.groups.every((group) => collectDraftErrores(group.rows, group.drafts).length === 0);
  }

  async openSession(): Promise<void> {
    this.error = null;
    this.peajeId = this.initialPeajeId || this.peajes[0]?.id || this.stations[0]?.peajeId || '';
    const initial = this.initialEstacionId || this.stations.find((station) => station.peajeId === this.peajeId)?.id;
    if (!initial) return;
    const station = this.stations.find((item) => item.id === initial);
    if (!station) return;
    const base: TarifarioStationGroup = { id: `editor-${initial}`, stationIds: [initial], family: station.family };
    this.groups = [await this.loadGroup(base, this.peajeId, this.initialSentido)];
  }

  async addGroup(): Promise<void> {
    const result = addTariffGroup(this.groups, this.selectedStationIds, this.stations);
    if (result.error) {
      this.error = result.error;
      return;
    }
    const added = result.groups.find((group) => group.stationIds.length > 1 && !this.groups.some((current) => current.id === group.id));
    const existingById = new Map(this.groups.map((group) => [group.id, group]));
    this.groups = result.groups.map((candidate) => existingById.get(candidate.id) ?? {
      ...candidate, peajeId: this.peajeId, rows: [], drafts: {}, addedDraftCategories: [], loading: true, error: null,
    });
    this.selectedStationIds = [];
    this.error = null;
    if (added) {
      const loaded = await this.loadGroup(added, this.peajeId, added.family === 'AMBAS' ? 'AMBAS' : 'IDA');
      this.groups = this.groups.map((group) => group.id === added.id ? loaded : group);
    }
  }

  async removeStation(group: ManageGroup, stationId: string): Promise<void> {
    const result = removeStationFromTariffGroup(this.groups, group.id, stationId);
    if (!result.removed) return;
    const existingById = new Map(this.groups.map((candidate) => [candidate.id, candidate]));
    this.groups = result.groups.map((candidate) => existingById.get(candidate.id) ?? {
      ...candidate, peajeId: this.peajeId, rows: [], drafts: {}, addedDraftCategories: [], loading: true, error: null,
    });
    const singleton = this.groups.find((candidate) => candidate.stationIds.length === 1 && candidate.stationIds[0] === stationId);
    if (singleton) {
      const loaded = await this.loadGroup(singleton, this.peajeId, this.initialSentido);
      this.groups = this.groups.map((candidate) => candidate.id === singleton.id ? loaded : candidate);
    }
  }

  onDraftChange(group: ManageGroup, change: TarifarioDraftChange): void {
    const current = group.drafts[change.categoria] ?? { no_pico: '', pico: '' };
    group.drafts = { ...group.drafts, [change.categoria]: change.status === 'NO_PICO'
      ? { ...current, no_pico: change.value } : { ...current, pico: change.value } };
  }

  async addCategoria(group: ManageGroup): Promise<void> {
    const next = this.nextCategory(group);
    if (next.action === 'ENABLE') {
      await this.onCategoryStateChange(group, {
        categoria: next.categoria,
        enabled: true,
        tarifaIds: [],
      });
      return;
    }
    if (next.action !== 'DRAFT') return;
    const nextRow = buildEditorRows([], [next.categoria])[0];
    if (!nextRow) return;
    if (!group.rows.some((row) => row.categoria === next.categoria)) {
      group.rows = [...group.rows, nextRow];
    }
    group.addedDraftCategories = [...new Set([...group.addedDraftCategories, next.categoria])];
    group.drafts = { ...group.drafts, [next.categoria]: { no_pico: '', pico: '' } };
  }

  async onCategoryStateChange(group: ManageGroup, change: TarifarioCategoryStateChange): Promise<void> {
    const changes: TarifarioCategoriaEstadoCambio[] = group.stationIds.map((estacionId) => ({
      peajeId: group.peajeId,
      estacionId,
      sentido: this.initialSentido,
      categoria: change.categoria,
      enabled: change.enabled,
    }));
    try {
      await firstValueFrom(this.tarifario.actualizarEstadoCategorias(changes));
      const refreshed = await this.loadGroup(group, group.peajeId, this.initialSentido);
      this.groups = this.groups.map((candidate) => candidate.id === group.id ? refreshed : candidate);
    } catch {
      this.error = 'No se pudo actualizar el estado de la categoría. El valor anterior se conserva.';
    }
  }

  canAddCategoria(group: ManageGroup): boolean {
    return this.nextCategory(group).action !== 'NONE';
  }

  nextCategory(group: ManageGroup): CategoryAction {
    return nextCategoryAction(this.categoryIdentities(group), 10, this.draftCategories(group));
  }

  async save(): Promise<void> {
    if (!this.canSave) return;
    const fecha = toDateInputValue(this.vigenteDesde.from);
    if (!fecha) return;
    const changes: TarifarioGroupChange[] = [];
    for (const group of this.groups) {
      const rows = collectCambios(group.rows, group.drafts);
      for (const stationId of group.stationIds) {
        for (const change of rows) {
          changes.push({ peajeId: group.peajeId, estacionId: stationId, sentido: this.initialSentido, categoria: change.categoria, status: change.status, importe: change.importe, fechaVigenciaInicio: fecha });
        }
      }
    }
    this.saving = true;
    this.error = null;
    try {
      await firstValueFrom(this.tarifario.guardarGrupos(changes));
      this.saved.emit();
      this.close();
    } catch {
      this.error = 'No se pudieron guardar los grupos. Revisá las fechas y los importes; los borradores se conservaron.';
    } finally {
      this.saving = false;
    }
  }

  close(): void {
    this.closed.emit();
  }

  private async loadGroup(group: TarifarioStationGroup, peajeId: string, sentido: TarifaSentido): Promise<ManageGroup> {
    try {
      const payload = await firstValueFrom(this.tarifario.obtenerEditor(peajeId, group.stationIds[0], sentido));
      const rows = buildEditorRows(payload.existentes, categoriasEditor(countCategoriasEditor(payload.existentes)));
      const drafts: TarifarioEditorDrafts = {};
      rows.forEach((row) => drafts[row.categoria] = { no_pico: '', pico: '' });
      return { ...group, peajeId, rows, drafts, addedDraftCategories: [], loading: false, error: null };
    } catch {
      return { ...group, peajeId, rows: [], drafts: {}, addedDraftCategories: [], loading: false, error: 'No se pudo cargar la estación.' };
    }
  }

  private categoryIdentities(group: ManageGroup) {
    return group.rows.flatMap((row) => [row.no_pico, row.pico].map((cell) => ({
      categoria: row.categoria,
      enabled: cell.enabled !== false,
      tarifaId: cell.tarifa_id,
    })));
  }

  private draftCategories(group: ManageGroup): number[] {
    return group.addedDraftCategories;
  }
}
