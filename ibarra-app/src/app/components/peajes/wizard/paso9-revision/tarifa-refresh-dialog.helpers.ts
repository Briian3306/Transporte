import { CandidatoRefrescoTarifa, ResultadoDetectarRefresco } from '../../models/tarifa-refresh.contracts';
import { ConfiguracionPlantilla } from '../../models/peajes.models';
import { TarifaSentido, TarifaStatusPico } from '../../models/tarifario.contracts';

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
  sharedStationIds: readonly string[];
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

export function deriveEditorGroups(state: SharedTariffGroupState): EditorGroup[] {
  const detected = uniqueDetectedStations(state.detectedStations);
  const detectedIds = new Set(detected.map((station) => station.estacionId));
  const sharedWanted = new Set(state.sharedStationIds.filter((id) => detectedIds.has(id)));

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
