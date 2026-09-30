import type { TarifarioStationGroup } from '../models/tarifario.contracts';

export interface TarifarioGroupStation {
  id: string;
  name: string;
  peajeId: string;
  family: 'AMBAS' | 'DIRECCIONAL';
}

export type CategoryIdentity = {
  categoria: number;
  enabled: boolean;
  tarifaId: string | null;
};

export type CategoryAction = { categoria: number; action: 'ENABLE' | 'DRAFT' | 'NONE' };

export interface CategoryState {
  categoria: number;
  enabled: boolean;
  hasExisting: boolean;
  tarifaIds: string[];
}

let nextGroupNumber = 0;

function groupId(): string {
  nextGroupNumber += 1;
  return `tarifa-group-${nextGroupNumber}`;
}

export function createSingletonTariffGroups(
  stations: readonly TarifarioGroupStation[],
): TarifarioStationGroup[] {
  return stations.map((station) => ({
    id: groupId(),
    stationIds: [station.id],
    family: station.family,
  }));
}

function stationMap(stations: readonly TarifarioGroupStation[]): Map<string, TarifarioGroupStation> {
  return new Map(stations.map((station) => [station.id, station]));
}

export function addTariffGroup(
  groups: readonly TarifarioStationGroup[],
  stationIds: readonly string[],
  stations: readonly TarifarioGroupStation[],
): { groups: TarifarioStationGroup[]; error: string | null } {
  const uniqueIds = [...new Set(stationIds)];
  if (uniqueIds.length < 2) {
    return { groups: [...groups], error: 'Seleccioná al menos dos estaciones para crear un grupo.' };
  }
  const byId = stationMap(stations);
  const selected = uniqueIds.map((id) => byId.get(id));
  if (selected.some((station) => !station)) {
    return { groups: [...groups], error: 'La estación seleccionada no pertenece al catálogo.' };
  }
  const existingInSharedGroup = new Set(
    groups.filter((group) => group.stationIds.length > 1).flatMap((group) => group.stationIds),
  );
  if (uniqueIds.some((id) => existingInSharedGroup.has(id))) {
    return { groups: [...groups], error: 'Cada estación puede pertenecer a un solo grupo.' };
  }
  const first = selected[0]!;
  if (selected.some((station) => station!.peajeId !== first.peajeId || station!.family !== first.family)) {
    return {
      groups: [...groups],
      error: 'Las estaciones deben pertenecer al mismo peaje y familia de sentido.',
    };
  }
  const selectedSet = new Set(uniqueIds);
  return {
    groups: [
      ...groups.filter((group) => !(group.stationIds.length === 1 && selectedSet.has(group.stationIds[0]))),
      { id: groupId(), stationIds: uniqueIds, family: first.family },
    ],
    error: null,
  };
}

export function removeStationFromTariffGroup(
  groups: readonly TarifarioStationGroup[],
  groupIdToEdit: string,
  stationId: string,
): { groups: TarifarioStationGroup[]; removed: boolean } {
  const index = groups.findIndex((group) => group.id === groupIdToEdit);
  if (index < 0) return { groups: [...groups], removed: false };
  const group = groups[index];
  if (!group.stationIds.includes(stationId) || group.stationIds.length < 2) {
    return { groups: [...groups], removed: false };
  }
  const remaining = group.stationIds.filter((id) => id !== stationId);
  const next = [...groups];
  next[index] = { ...group, stationIds: remaining };
  next.push({ id: groupId(), stationIds: [stationId], family: group.family });
  return { groups: next, removed: true };
}

export function nextCategoryAction(
  identities: readonly CategoryIdentity[],
  maxCategory = 10,
  draftCategories: readonly number[] = [],
): CategoryAction {
  const byCategory = new Map<number, CategoryState>();
  for (const identity of identities) {
    const current = byCategory.get(identity.categoria) ?? {
      categoria: identity.categoria,
      enabled: true,
      hasExisting: false,
      tarifaIds: [],
    };
    if (identity.tarifaId) {
      current.hasExisting = true;
      current.enabled = current.enabled && identity.enabled;
      current.tarifaIds.push(identity.tarifaId);
    }
    byCategory.set(identity.categoria, current);
  }
  const highestEnabled = Math.max(
    [...byCategory.values()]
      .filter((category) => category.hasExisting && category.enabled)
      .reduce((max, category) => Math.max(max, category.categoria), 0),
    ...draftCategories,
  );
  for (let categoria = Math.max(1, highestEnabled + 1); categoria <= maxCategory; categoria += 1) {
    const category = byCategory.get(categoria);
    if (!category || !category.hasExisting) return { categoria, action: 'DRAFT' };
    if (!category.enabled) return { categoria, action: 'ENABLE' };
  }
  return { categoria: maxCategory, action: 'NONE' };
}

export function categoryStateForIdentities(
  identities: readonly CategoryIdentity[],
  categoria?: number,
): CategoryState {
  const selected = identities.filter((identity) => categoria == null || identity.categoria === categoria);
  const existing = selected.filter((identity) => !!identity.tarifaId);
  return {
    categoria: categoria ?? existing[0]?.categoria ?? 0,
    enabled: existing.every((identity) => identity.enabled),
    hasExisting: existing.length > 0,
    tarifaIds: existing.map((identity) => identity.tarifaId!).filter(Boolean),
  };
}
