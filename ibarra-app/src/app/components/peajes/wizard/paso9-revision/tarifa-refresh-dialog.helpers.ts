import { CandidatoRefrescoTarifa, ResultadoDetectarRefresco } from '../../models/tarifa-refresh.contracts';
import { ConfiguracionPlantilla } from '../../models/peajes.models';
import {
  TarifaSentido,
  TarifaStatusPico,
  type TarifarioHistorialImporteHit,
  type TarifarioHistorialImporteMatch,
  type TarifarioStationGroup,
} from '../../models/tarifario.contracts';

export type SentidoFamily = 'AMBAS' | 'DIRECCIONAL' | 'SIN_TARIFARIO';

export interface EstacionCatalogoRefresco {
  estacionId: string;
  estacionNombre: string;
  peajeId: string;
  peajeNombre: string;
  sentidosExistentes: TarifaSentido[];
}

export interface EstacionOpcionRefresco {
  estacionId: string;
  estacionNombre: string;
  pendiente: boolean;
  sentidosExistentes: TarifaSentido[];
}

export interface IdentidadTarifaExistente {
  estacionId: string;
  categoria: number;
  status: TarifaStatusPico;
  sentido: TarifaSentido;
  requiereNormalizacionIva?: boolean | null;
  enabled?: boolean;
}

export interface ResolverIvaOpciones {
  override?: boolean | null;
  plantillaSugiere?: boolean;
}

export interface GrupoPendienteRefresco {
  key: string;
  peajeId: string;
  peajeNombre: string;
  family: SentidoFamily;
  opciones: EstacionOpcionRefresco[];
  itemsPorEstacion: Map<string, ResultadoDetectarRefresco[]>;
}

export const STATION_SESSION_PALETTE = [
  '#6D28D9',
  '#15803D',
  '#0369A1',
  '#B45309',
  '#BE123C',
  '#0F766E',
] as const;

export type StationSessionColor = (typeof STATION_SESSION_PALETTE)[number];

export interface DetectedStation {
  estacionId: string;
  estacionNombre: string;
  peajeId: string;
  peajeNombre: string;
  color: StationSessionColor;
  family: SentidoFamily;
}

export interface SharedTariffGroupState {
  detectedStations: readonly DetectedStation[];
  sharedStationIds?: readonly string[];
  groups?: readonly TarifarioStationGroup[];
}

export interface EditorGroup {
  stationIds: readonly string[];
  stations: readonly DetectedStation[];
}

export interface StationTraceViewModel {
  estacionId: string;
  estacionNombre: string;
  color: StationSessionColor;
}

export interface AutocompleteCandidate {
  id: string;
  estacionId: string;
  estacionNombre: string;
  amount: number;
  categoria: number | null;
  status: TarifaStatusPico | null;
  sentido: TarifaSentido | null;
}

export interface IdentityCellPrefill {
  categoria: number;
  status: TarifaStatusPico;
  sentido: TarifaSentido;
  amount: number;
}

export interface CandidateTraceViewModel {
  candidateId: string;
  estacionId: string;
  estacionNombre: string;
  color: StationSessionColor;
  amount: number;
}

export interface SafeAutocompleteAssignment {
  visible: CandidateTraceViewModel[];
  prefills: IdentityCellPrefill[];
}

const SENTIDO_ORDER: TarifaSentido[] = ['IDA', 'VUELTA', 'AMBAS'];

export function sentidoFamilyOf(sentidosExistentes: readonly TarifaSentido[]): SentidoFamily {
  if (sentidosExistentes.includes('AMBAS')) return 'AMBAS';
  if (sentidosExistentes.includes('IDA') || sentidosExistentes.includes('VUELTA')) return 'DIRECCIONAL';
  return 'SIN_TARIFARIO';
}

export function familySentidos(
  family: SentidoFamily,
  sentidosExistentesInterseccion: readonly TarifaSentido[],
): TarifaSentido[] {
  if (family === 'AMBAS') return ['AMBAS'];
  if (family === 'DIRECCIONAL') {
    return (['IDA', 'VUELTA'] as const).filter((sentido) =>
      sentidosExistentesInterseccion.includes(sentido),
    );
  }
  return [];
}

export function interseccionSentidos(listas: readonly TarifaSentido[][]): TarifaSentido[] {
  if (!listas.length) return [];
  return SENTIDO_ORDER.filter((sentido) => listas.every((lista) => lista.includes(sentido)));
}

export function agruparPendientesPorPeajeYFamilia(
  unresolved: readonly ResultadoDetectarRefresco[],
  catalogo: readonly EstacionCatalogoRefresco[],
): GrupoPendienteRefresco[] {
  const byId = new Map(catalogo.map((row) => [row.estacionId, row]));
  const groups = new Map<string, GrupoPendienteRefresco>();

  for (const item of unresolved) {
    const row = byId.get(item.estacionId);
    const peajeId = item.peajeId || row?.peajeId || '';
    const family = sentidoFamilyOf(row?.sentidosExistentes ?? []);
    const key = `${peajeId}|${family}`;
    let grupo = groups.get(key);
    if (!grupo) {
      const sameFamily = catalogo.filter(
        (estacion) =>
          estacion.peajeId === peajeId &&
          sentidoFamilyOf(estacion.sentidosExistentes) === family,
      );
      grupo = {
        key,
        peajeId,
        peajeNombre: row?.peajeNombre || '',
        family,
        opciones: sameFamily.map((estacion) => ({
          estacionId: estacion.estacionId,
          estacionNombre: estacion.estacionNombre,
          pendiente: unresolved.some((r) => r.estacionId === estacion.estacionId),
          sentidosExistentes: [...estacion.sentidosExistentes],
        })),
        itemsPorEstacion: new Map(),
      };
      groups.set(key, grupo);
    }
    const list = grupo.itemsPorEstacion.get(item.estacionId) ?? [];
    list.push(item);
    grupo.itemsPorEstacion.set(item.estacionId, list);
  }

  return [...groups.values()];
}

export function heuristicaSeleccionInicial(
  grupo: GrupoPendienteRefresco,
  candidatos: readonly CandidatoRefrescoTarifa[],
): string[] {
  const anchorId = [...grupo.itemsPorEstacion.keys()][0];
  if (!anchorId) return [];

  const selected = new Set<string>([anchorId]);
  const anchors = grupo.itemsPorEstacion.get(anchorId) ?? [];
  const signatures = new Set(
    anchors.flatMap((item) =>
      signaturesDe(
        item.categoria,
        item.status,
        item.candidatePrice ?? precioDeCandidato(candidatos, item),
      ),
    ),
  );

  for (const opcion of grupo.opciones) {
    if (opcion.estacionId === anchorId) continue;
    const related = candidatos.filter((c) => c.estacionId === opcion.estacionId);
    const matches = related.some((c) =>
      signaturesDe(c.categoria, c.statusSolicitado, c.precioDirecto).some((sig) =>
        signatures.has(sig),
      ),
    );
    if (matches) selected.add(opcion.estacionId);
  }

  return grupo.opciones
    .map((opcion) => opcion.estacionId)
    .filter((id) => selected.has(id));
}

export function resolverRequiereNormalizacionIva(
  estacionId: string,
  categoria: number,
  status: TarifaStatusPico,
  sentido: TarifaSentido,
  catalogoExistentes: readonly IdentidadTarifaExistente[],
  opciones: ResolverIvaOpciones = {},
): boolean | null {
  const exists = catalogoExistentes.some(
    (row) =>
      row.estacionId === estacionId &&
      row.categoria === categoria &&
      row.status === status &&
      row.sentido === sentido,
  );
  if (exists) return null;
  if (typeof opciones.override === 'boolean') return opciones.override;
  const sameStation = catalogoExistentes.filter(
    (row) => row.estacionId === estacionId && typeof row.requiereNormalizacionIva === 'boolean',
  );
  if (sameStation.length) return sameStation.some((row) => row.requiereNormalizacionIva === true);
  const known = catalogoExistentes.filter((row) => typeof row.requiereNormalizacionIva === 'boolean');
  if (known.length) return known.some((row) => row.requiereNormalizacionIva === true);
  if (catalogoExistentes.length) return false;
  return opciones.plantillaSugiere === true;
}

const IVA_DIVISORES = new Set([1.21, 1.31]);

export function plantillaSugiereNormalizacionIva(
  configs: readonly ConfiguracionPlantilla[] | null | undefined,
): boolean {
  return (configs ?? []).some((cfg) => {
    const code = cfg.configuracion?.['algoritmo_codigo'];
    if (code === 'ELIMINAR_IVA') return true;
    if (code !== 'OPERAR_NUMERO') return false;
    const operacion = String(cfg.configuracion?.['operacion'] ?? '').toLowerCase();
    const valor = Number(cfg.configuracion?.['valor']);
    return operacion === 'dividir' && IVA_DIVISORES.has(valor);
  });
}

function precioDeCandidato(
  candidatos: readonly CandidatoRefrescoTarifa[],
  item: ResultadoDetectarRefresco,
): number | null {
  const related = candidatos.find((c) =>
    c.rowIndexes.some((idx) => item.rowIndexes.includes(idx)),
  );
  return related?.precioDirecto ?? null;
}

function signaturesDe(
  categoria: number | null | undefined,
  status: TarifaStatusPico | null | undefined,
  precio: number | null | undefined,
): string[] {
  if (categoria == null || precio == null) return [];
  const priceKey = String(precio);
  if (status) return [`${categoria}|${status}|${priceKey}`];
  return [`${categoria}|NO_PICO|${priceKey}`, `${categoria}|PICO|${priceKey}`];
}

export function buildDetectedStations(
  imported: readonly ResultadoDetectarRefresco[],
  catalogo: readonly EstacionCatalogoRefresco[] = [],
): DetectedStation[] {
  const byId = new Map(catalogo.map((row) => [row.estacionId, row]));
  const seen = new Set<string>();
  const stations: DetectedStation[] = [];
  for (const item of imported) {
    if (seen.has(item.estacionId)) continue;
    seen.add(item.estacionId);
    const row = byId.get(item.estacionId);
    stations.push({
      estacionId: item.estacionId,
      estacionNombre: row?.estacionNombre || item.estacionId,
      peajeId: item.peajeId || row?.peajeId || '',
      peajeNombre: row?.peajeNombre || '',
      color: STATION_SESSION_PALETTE[stations.length % STATION_SESSION_PALETTE.length],
      family: sentidoFamilyOf(row?.sentidosExistentes ?? []),
    });
  }
  return stations;
}

export function stationTraceViewModel(station: DetectedStation): StationTraceViewModel {
  return {
    estacionId: station.estacionId,
    estacionNombre: station.estacionNombre,
    color: station.color,
  };
}

export function maxSharedGroupCount(stationCount: number): number {
  return Math.max(1, Math.floor(stationCount / 2));
}

export function resizeSharedSlots(
  slots: readonly (readonly string[])[],
  nextCount: number,
): string[][] {
  const count = Math.max(1, nextCount);
  const next = slots.slice(0, count).map((slot) => [...slot]);
  while (next.length < count) next.push([]);
  return next;
}

export function applySharedSlotSelection(
  slots: readonly (readonly string[])[],
  slotIndex: number,
  nextIds: readonly string[],
): string[][] {
  const ownedElsewhere = new Set(
    slots.flatMap((slot, index) => (index === slotIndex ? [] : [...slot])),
  );
  const unique = [...new Set(nextIds)].filter((id) => !ownedElsewhere.has(id));
  return slots.map((slot, index) => (index === slotIndex ? unique : [...slot]));
}

export interface SharedSlotCheckboxOption {
  value: string;
  label: string;
  disabled?: boolean;
  style: { badgeColor: string; iconColor: string };
}

export function checkboxOptionsForSlot(
  stations: readonly DetectedStation[],
  slots: readonly (readonly string[])[],
  slotIndex: number,
): SharedSlotCheckboxOption[] {
  const usedElsewhere = new Set(
    slots.flatMap((slot, index) => (index === slotIndex ? [] : [...slot])),
  );
  return stations.map((station) => ({
    value: station.estacionId,
    label: station.estacionNombre,
    disabled: usedElsewhere.has(station.estacionId),
    style: { badgeColor: station.color, iconColor: station.color },
  }));
}

export function sharedSlotsToTarifarioGroups(
  slots: readonly (readonly string[])[],
  family: 'AMBAS' | 'DIRECCIONAL',
): TarifarioStationGroup[] {
  return slots
    .filter((slot) => slot.length >= 2)
    .map((slot, index) => ({
      id: `shared-slot-${index}`,
      stationIds: [...slot],
      family,
    }));
}

export function deriveEditorGroups(state: SharedTariffGroupState): EditorGroup[] {
  const detected = uniqueDetectedStations(state.detectedStations);
  const detectedIds = new Set(detected.map((station) => station.estacionId));
  if (state.groups?.length) {
    const byId = new Map(detected.map((station) => [station.estacionId, station]));
    const used = new Set<string>();
    const explicit: EditorGroup[] = [];
    for (const configured of state.groups) {
      const stations = configured.stationIds
        .map((id) => byId.get(id))
        .filter((station): station is DetectedStation => !!station && station.family === configured.family && !used.has(station.estacionId));
      if (!stations.length) continue;
      explicit.push(toEditorGroup(stations));
      stations.forEach((station) => used.add(station.estacionId));
    }
    return [...explicit, ...detected.filter((station) => !used.has(station.estacionId)).map((station) => [station]).map(toEditorGroup)];
  }
  const sharedWanted = new Set((state.sharedStationIds ?? []).filter((id) => detectedIds.has(id)));

  const clusters = new Map<string, DetectedStation[]>();
  const clusterOrder: string[] = [];
  for (const station of detected) {
    if (!sharedWanted.has(station.estacionId)) continue;
    const key = `${station.peajeId}|${station.family}`;
    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = [];
      clusters.set(key, cluster);
      clusterOrder.push(key);
    }
    cluster.push(station);
  }

  const sharedGroups: DetectedStation[][] = [];
  const consumed = new Set<string>();
  for (const key of clusterOrder) {
    const members = clusters.get(key) ?? [];
    if (members.length < 2) continue;
    sharedGroups.push(members);
    for (const member of members) consumed.add(member.estacionId);
  }

  const independents = detected.filter((station) => !consumed.has(station.estacionId));
  return [...sharedGroups, ...independents.map((station) => [station])].map(toEditorGroup);
}

export function preserveIdentityDrafts(
  drafts: Readonly<Record<string, string>>,
  detectedStationIds: readonly string[],
): Record<string, string> {
  const allowed = new Set(detectedStationIds);
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(drafts)) {
    const separator = key.indexOf('|');
    const estacionId = separator < 0 ? key : key.slice(0, separator);
    if (allowed.has(estacionId)) next[key] = value;
  }
  return next;
}

export function assignSafeAutocomplete(
  group: EditorGroup,
  candidates: readonly AutocompleteCandidate[],
): SafeAutocompleteAssignment {
  const stationById = new Map(group.stations.map((station) => [station.estacionId, station]));
  const visible: CandidateTraceViewModel[] = [];
  for (const candidate of candidates) {
    const station = stationById.get(candidate.estacionId);
    if (!station) continue;
    visible.push({
      candidateId: candidate.id,
      estacionId: candidate.estacionId,
      estacionNombre: station.estacionNombre,
      color: station.color,
      amount: candidate.amount,
    });
  }

  const mapped = candidates.filter(
    (candidate) =>
      stationById.has(candidate.estacionId) &&
      candidate.categoria != null &&
      candidate.status != null &&
      candidate.sentido != null,
  );

  const cells = new Map<string, IdentityCellPrefill>();
  for (const candidate of mapped) {
    const cellKey = identityCellKey(candidate.categoria!, candidate.status!, candidate.sentido!);
    if (!cells.has(cellKey)) {
      cells.set(cellKey, {
        categoria: candidate.categoria!,
        status: candidate.status!,
        sentido: candidate.sentido!,
        amount: candidate.amount,
      });
    }
  }

  const prefills: IdentityCellPrefill[] = [];
  for (const [cellKey, cell] of cells) {
    const perStation = new Map<string, Set<number>>();
    for (const candidate of mapped) {
      if (identityCellKey(candidate.categoria!, candidate.status!, candidate.sentido!) !== cellKey) {
        continue;
      }
      const amounts = perStation.get(candidate.estacionId) ?? new Set<number>();
      amounts.add(candidate.amount);
      perStation.set(candidate.estacionId, amounts);
    }

    let agreed: number | null = null;
    let compatible = true;
    for (const estacionId of group.stationIds) {
      const amounts = perStation.get(estacionId);
      if (!amounts || amounts.size !== 1) {
        compatible = false;
        break;
      }
      const amount = [...amounts][0];
      if (agreed == null) agreed = amount;
      else if (agreed !== amount) {
        compatible = false;
        break;
      }
    }
    if (compatible && agreed != null) {
      prefills.push({ ...cell, amount: agreed });
    }
  }

  return { visible, prefills };
}

function uniqueDetectedStations(stations: readonly DetectedStation[]): DetectedStation[] {
  const seen = new Set<string>();
  const unique: DetectedStation[] = [];
  for (const station of stations) {
    if (seen.has(station.estacionId)) continue;
    seen.add(station.estacionId);
    unique.push(station);
  }
  return unique;
}

function toEditorGroup(stations: readonly DetectedStation[]): EditorGroup {
  return {
    stationIds: stations.map((station) => station.estacionId),
    stations,
  };
}

function identityCellKey(
  categoria: number,
  status: TarifaStatusPico,
  sentido: TarifaSentido,
): string {
  return `${categoria}|${status}|${sentido}`;
}

export const TARIFA_PRICE_TOLERANCE = 0.01;

export function withinTarifaPriceTolerance(candidate: number, importe: number): boolean {
  return Number.isFinite(candidate) && importe > 0 && Math.abs(candidate - importe) / importe <= TARIFA_PRICE_TOLERANCE;
}

export function hasDistinctPriceClusters(amounts: readonly number[]): boolean {
  const clusters: number[][] = [];
  for (const amount of amounts) {
    if (!Number.isFinite(amount)) continue;
    const cluster = clusters.find((group) => withinTarifaPriceTolerance(amount, group[0]));
    if (cluster) cluster.push(amount);
    else clusters.push([amount]);
  }
  return clusters.length > 1;
}

export interface LeftoverMergeItem {
  identityKey: string;
  amount: number;
  cases: number;
  fechaPasada?: string | null;
}

export interface LeftoverMergeConflict<T extends LeftoverMergeItem> {
  identityKey: string;
  amounts: number[];
  items: T[];
}

export interface LeftoverMergeResult<T extends LeftoverMergeItem> {
  merged: T[];
  conflict: LeftoverMergeConflict<T> | null;
}

export function mergeLeftoversByIdentity<T extends LeftoverMergeItem>(
  items: readonly T[],
): LeftoverMergeResult<T> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const list = groups.get(item.identityKey) ?? [];
    list.push(item);
    groups.set(item.identityKey, list);
  }
  const merged: T[] = [];
  for (const group of groups.values()) {
    const clusters: T[][] = [];
    for (const item of group) {
      const cluster = clusters.find((existing) => withinTarifaPriceTolerance(item.amount, existing[0].amount));
      if (cluster) cluster.push(item);
      else clusters.push([item]);
    }
    clusters.sort((left, right) => leftoverClusterFecha(left).localeCompare(leftoverClusterFecha(right)));
    for (const cluster of clusters) {
      if (cluster.length === 0) continue;
      const representative = cluster.reduce((best, item) => (item.cases > best.cases ? item : best));
      merged.push({
        ...representative,
        cases: cluster.reduce((sum, item) => sum + item.cases, 0),
        amount: representative.amount,
      });
    }
  }
  return { merged, conflict: null };
}

function leftoverClusterFecha<T extends LeftoverMergeItem>(cluster: readonly T[]): string {
  return cluster.reduce((best, item) => {
    const fecha = item.fechaPasada?.trim() ?? '';
    return fecha > best ? fecha : best;
  }, '');
}

export interface HighestIdentityOption {
  key: string;
  categoria: number;
  status: TarifaStatusPico;
  sentido: TarifaSentido;
}

/** Paso 9: unique identity among 1% hits at one category. No fallback across categories. */
export function uniqueHighestCategoryIdentity<T extends HighestIdentityOption>(
  matches: readonly T[],
): T | null {
  return uniqueIdentityForCategory(matches);
}

export function uniqueIdentityForCategory<T extends HighestIdentityOption>(
  matches: readonly T[],
  categoria?: number | null,
): T | null {
  if (!matches.length) return null;
  const scoped =
    categoria == null ? matches : matches.filter((option) => option.categoria === categoria);
  if (!scoped.length) return null;
  const categories = new Set(scoped.map((option) => option.categoria));
  if (categories.size !== 1) return null;
  if (new Set(scoped.map((option) => option.key)).size !== 1) return null;
  return scoped[0] ?? null;
}

export function resolveCategoriaEfectiva(
  recibida: number | null | undefined,
  catalogRows: ReadonlyArray<{ estacion_id: string; categoria: number; enabled?: boolean | null }>,
  estacionId: string,
): number | null {
  if (recibida == null || !Number.isFinite(recibida)) return null;
  const capped = Math.trunc(recibida);
  const maxima = catalogRows
    .filter((row) => row.estacion_id === estacionId && row.enabled !== false)
    .reduce((max, row) => Math.max(max, row.categoria), Number.NEGATIVE_INFINITY);
  if (!Number.isFinite(maxima)) return capped;
  return Math.min(capped, maxima);
}

export function findHistoryHit(
  hits: readonly TarifarioHistorialImporteHit[],
  estacionId: string,
  importe: number,
  categoria?: number | null,
): TarifarioHistorialImporteHit | null {
  return (
    hits.find((hit) => {
      if (hit.estacionId !== estacionId) return false;
      if (!withinTarifaPriceTolerance(importe, hit.importeConsultado)) return false;
      if (categoria == null) return true;
      if (hit.categoria === categoria) return true;
      return (hit.matches ?? []).some((match) => match.categoria === categoria);
    }) ?? null
  );
}

export function historyMatchesForCategory(
  hit: TarifarioHistorialImporteHit | null | undefined,
  status?: TarifaStatusPico | null,
  categoria?: number | null,
): TarifarioHistorialImporteMatch[] {
  if (!hit) return [];
  const matches =
    hit.matches?.length
      ? hit.matches
      : hit.tarifaId && hit.categoria != null && hit.status && hit.sentido && hit.importe != null
        ? [
            {
              tarifaId: hit.tarifaId,
              categoria: hit.categoria,
              status: hit.status,
              sentido: hit.sentido,
              importe: hit.importe,
            },
          ]
        : [];
  return matches.filter((match) => {
    if (status && match.status !== status) return false;
    if (categoria != null && match.categoria !== categoria) return false;
    return true;
  });
}

export function uniqueHistoryIdentity(
  hit: TarifarioHistorialImporteHit | null | undefined,
  status?: TarifaStatusPico | null,
  categoria?: number | null,
): { categoria: number; status: TarifaStatusPico; sentido: TarifaSentido } | null {
  const top = historyMatchesForCategory(hit, status, categoria);
  if (new Set(top.map((match) => match.tarifaId)).size !== 1) return null;
  const [match] = top;
  return { categoria: match.categoria, status: match.status, sentido: match.sentido };
}

export type ConfirmNewVigenciaPreflight =
  | { kind: 'omit' }
  | { kind: 'error'; message: string }
  | { kind: 'ok' };

export function confirmNewVigenciaPreflight(params: {
  importe: number;
  fechaVigenciaInicio: string | null;
  catalog: {
    importe: number | null;
    fechaVigenciaInicio: string | null;
    estacionNombre?: string | null;
    categoria: number;
    status: TarifaStatusPico;
  } | null;
  forcePersist?: boolean;
}): ConfirmNewVigenciaPreflight {
  if (!params.catalog || params.catalog.importe == null || params.catalog.importe <= 0) return { kind: 'ok' };
  if (!params.forcePersist && withinTarifaPriceTolerance(params.importe, params.catalog.importe)) {
    return { kind: 'omit' };
  }
  const catalogStart = params.catalog.fechaVigenciaInicio;
  const newStart = params.fechaVigenciaInicio;
  if (!catalogStart || !newStart || newStart > catalogStart) return { kind: 'ok' };
  const statusLabel = params.catalog.status === 'PICO' ? 'Pico' : 'No pico';
  const estacion = params.catalog.estacionNombre?.trim() || 'la estación';
  return {
    kind: 'error',
    message: `La vigencia nueva se superpone o inicia antes del vigente en ${estacion} · cat. ${params.catalog.categoria} · ${statusLabel} (nuevo ${newStart}, vigente ${catalogStart}).`,
  };
}
