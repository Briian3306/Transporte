/** Pure catalogue-gap classifier for pwbi_tarifas rows. No I/O, no Supabase. */

export const PEER_MAJORITY = 0.6;
export const SPARSE_MAX_CATS = 2;
export const CORREDORES = 'CORREDORES VIALES SA';
export const KNOWN_FLAT_STATIONS = new Set(['PASEO DEL BAJO', 'MAIPU']);

const STATUS_ORDER = ['PICO', 'NO_PICO', 'PENDIENTE'];

export function formatCategoryList(cats) {
  const nums = [...new Set((cats || []).map(Number).filter((n) => Number.isFinite(n)))]
    .sort((a, b) => a - b);
  if (!nums.length) return '';
  const consecutiveFrom1 = nums[0] === 1 && nums.every((n, i) => n === i + 1);
  if (consecutiveFrom1) return `1-${nums[nums.length - 1]}`;
  return nums.join(',');
}

export function categoriesMissing(expected, detected) {
  const have = new Set((detected || []).map(Number));
  const missing = (expected || []).map(Number).filter((n) => Number.isFinite(n) && !have.has(n));
  return missing.length ? missing.join(',') : '';
}

export function formatStatusList(statuses) {
  const set = new Set(statuses || []);
  return STATUS_ORDER.filter((s) => set.has(s)).join('+');
}

export function statusesMissing(expected, detected) {
  const have = new Set(detected || []);
  return (expected || []).filter((s) => !have.has(s)).join('+');
}

function parseNum(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseDate(value) {
  if (!value) return 0;
  let text = String(value).trim().replace(' ', 'T');
  text = text.replace(/([+-]\d{2})$/, '$1:00');
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : 0;
}

function dateOnly(value) {
  if (!value) return '';
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : String(value);
}

function flag(on) {
  return on ? 'TRUE' : '';
}

function range(from, to) {
  const out = [];
  for (let n = from; n <= to; n += 1) out.push(n);
  return out;
}

function stationKey(row) {
  return `${row.Peaje_ID}|${row.Estacion_ID}`;
}

function comboKey(peajeId, stationId, status, category) {
  return `${peajeId}|${stationId}|${status}|${category}`;
}

function buildStations(rows) {
  const stations = new Map();
  for (const r of rows) {
    const key = stationKey(r);
    if (!stations.has(key)) {
      stations.set(key, {
        peajeId: r.Peaje_ID,
        stationId: r.Estacion_ID,
        peaje: r.Peaje_Nombre,
        station: r.Estacion_Nombre,
        cats: new Set(),
        statuses: new Set(),
        confirmedPico: false,
        rows: [],
      });
    }
    const s = stations.get(key);
    const cat = parseNum(r.Categoria_Normalizada);
    if (cat != null) s.cats.add(cat);
    if (r.Status === 'PICO' || r.Status === 'NO_PICO') s.statuses.add(r.Status);
    if (r.Status === 'PICO') s.confirmedPico = true;
    s.rows.push(r);
  }
  return stations;
}

function clusterStations(stations) {
  const byPeaje = new Map();
  for (const s of stations.values()) {
    if (!byPeaje.has(s.peajeId)) byPeaje.set(s.peajeId, []);
    byPeaje.get(s.peajeId).push(s);
  }
  const clusters = [];
  for (const [peajeId, list] of byPeaje) {
    const groups = [
      { kind: 'has_pico', members: list.filter((s) => s.confirmedPico) },
      { kind: 'flat', members: list.filter((s) => !s.confirmedPico) },
    ];
    for (const g of groups) {
      if (!g.members.length) continue;
      const cluster = {
        peajeId,
        peaje: g.members[0].peaje,
        kind: g.kind,
        stations: g.members,
      };
      for (const s of g.members) s.cluster = cluster;
      clusters.push(cluster);
    }
  }
  return clusters;
}

function peerMajorityCats(cluster) {
  const nonSparse = cluster.stations.filter((s) => s.cats.size > SPARSE_MAX_CATS);
  const peers = nonSparse.length ? nonSparse : cluster.stations;
  const counts = new Map();
  for (const s of peers) {
    for (const c of s.cats) counts.set(c, (counts.get(c) || 0) + 1);
  }
  const expected = [];
  for (const [cat, n] of counts) {
    if (n / peers.length >= PEER_MAJORITY) expected.push(cat);
  }
  return expected.sort((a, b) => a - b);
}

function estimateCluster(cluster) {
  if (cluster.peaje === CORREDORES && cluster.kind === 'flat') {
    cluster.expectedCats = [1, 2, 3, 4, 5];
    cluster.expectedStatuses = ['NO_PICO'];
    return;
  }

  if (cluster.kind === 'has_pico') {
    cluster.expectedStatuses = ['PICO', 'NO_PICO'];
    const nonSparse = cluster.stations.filter((s) => s.cats.size > SPARSE_MAX_CATS);
    const peers = nonSparse.length ? nonSparse : cluster.stations;
    const peersHave1 = peers.some((s) => s.cats.has(1));
    if (peersHave1) {
      const maxPeer = Math.max(0, ...peers.flatMap((s) => [...s.cats]));
      const to = maxPeer >= 7 ? 7 : maxPeer >= 6 ? 6 : maxPeer;
      cluster.expectedCats = range(1, to);
    } else {
      cluster.expectedCats = peerMajorityCats(cluster);
    }
    return;
  }

  cluster.expectedStatuses = ['NO_PICO'];
  cluster.expectedCats = peerMajorityCats(cluster);
}

function peajeHasPico(stations, peajeId) {
  for (const s of stations.values()) {
    if (s.peajeId === peajeId && s.confirmedPico) return true;
  }
  return false;
}

function largestPicoCluster(clusters, peajeId) {
  const pico = clusters.filter((c) => c.peajeId === peajeId && c.kind === 'has_pico');
  if (!pico.length) return null;
  return pico.reduce((a, b) => (b.stations.length > a.stations.length ? b : a));
}

function expectedForStation(station, clusters, stations) {
  const cluster = station.cluster;
  const peakPeaje = peajeHasPico(stations, station.peajeId);
  if (cluster.kind === 'flat' && peakPeaje && station.peaje !== CORREDORES) {
    const donor = largestPicoCluster(clusters, station.peajeId);
    return {
      clusterKind: cluster.kind,
      expectedCats: donor?.expectedCats?.length ? donor.expectedCats : cluster.expectedCats,
      expectedStatuses: ['NO_PICO'],
      peakPeaje,
    };
  }
  return {
    clusterKind: cluster.kind,
    expectedCats: cluster.expectedCats,
    expectedStatuses: cluster.expectedStatuses,
    peakPeaje,
  };
}

function collapseKeys(rows) {
  const groups = new Map();
  const pending = new Map();
  for (const r of rows) {
    const cat = parseNum(r.Categoria_Normalizada);
    if (cat == null) continue;
    if (r.Status === 'PENDIENTE') {
      const pk = `${r.Peaje_ID}|${r.Estacion_ID}|${cat}`;
      if (!pending.has(pk)) pending.set(pk, []);
      pending.get(pk).push(r);
      continue;
    }
    if (r.Status !== 'PICO' && r.Status !== 'NO_PICO') continue;
    const key = comboKey(r.Peaje_ID, r.Estacion_ID, r.Status, cat);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return { groups, pending };
}

function latestOf(list) {
  return [...list].sort((a, b) => parseDate(b.fecha_aparicion) - parseDate(a.fecha_aparicion))[0];
}

function historialOf(list) {
  return [...list]
    .sort((a, b) => parseDate(a.fecha_aparicion) - parseDate(b.fecha_aparicion))
    .map((r) => `${r.Importe}@${dateOnly(r.fecha_aparicion)}`)
    .join('; ');
}

function peersWithCategory(cluster, category, exceptStationId) {
  return cluster.stations
    .filter((s) => s.stationId !== exceptStationId && s.cats.has(category))
    .map((s) => s.station);
}

function shouldEmitMissingCategory(station, category, expected) {
  if (!expected.includes(category)) return false;
  if (station.cats.has(category)) return false;
  if (station.cats.size <= SPARSE_MAX_CATS) return false;
  return true;
}

function blankCatalogueBase(station, exp) {
  const detectedCats = [...station.cats].sort((a, b) => a - b);
  const detectedStatuses = [...station.statuses];
  return {
    PEAJE_ID: station.peajeId,
    PEAJE_NOMBRE: station.peaje,
    STATION_ID: station.stationId,
    STATION_NOMBRE: station.station,
    CLUSTER: station.cluster.kind,
    CATEGORIES_DETECTED: formatCategoryList(detectedCats),
    EXPECTED_CATEGORIES: formatCategoryList(exp.expectedCats),
    CATEGORIES_MISSING: categoriesMissing(exp.expectedCats, detectedCats),
    STATUSES_DETECTED: formatStatusList(detectedStatuses),
    EXPECTED_STATUSES: formatStatusList(exp.expectedStatuses),
    STATUSES_MISSING: statusesMissing(exp.expectedStatuses, detectedStatuses),
    ACTION: '',
  };
}

function existingRow(station, exp, status, category, list) {
  const latest = latestOf(list);
  const importe = parseNum(latest.Importe);
  const missingPrice = importe == null;
  const dualPeajeHint = exp.peakPeaje && station.peaje !== CORREDORES;
  const sparseFlat = station.cats.size <= SPARSE_MAX_CATS && !station.confirmedPico && dualPeajeHint;
  const knownFlat = KNOWN_FLAT_STATIONS.has(station.station) && dualPeajeHint && !station.confirmedPico;
  const fullyFlatPeak = !station.confirmedPico && dualPeajeHint && station.cats.size > SPARSE_MAX_CATS;
  const review = sparseFlat || knownFlat || fullyFlatPeak;
  let diagnostic = '';
  if (sparseFlat) {
    diagnostic = `Sparse station (only cat ${formatCategoryList([...station.cats])}) vs ${station.peaje} expected ${formatCategoryList(exp.expectedCats)}. Not auto-inventing the rest.`;
  } else if (knownFlat || fullyFlatPeak) {
    diagnostic = `Station is fully NO_PICO while ${station.peaje} cluster is dual-status. Not MISSING_STATUS.`;
  }
  if (missingPrice) {
    diagnostic = diagnostic || 'Tariff catalogue exists but no associated amount was found.';
  }
  return {
    ...blankCatalogueBase(station, exp),
    STATUS: status,
    CATEGORY: category,
    IMPORTE: missingPrice ? '' : importe,
    FECHA_APARICION: latest.fecha_aparicion || '',
    N_IMPORTES: list.length,
    HISTORIAL: historialOf(list),
    MISSING_CATEGORY: '',
    MISSING_PRICE: flag(missingPrice),
    MISSING_STATUS: '',
    REVIEW_REQUIRED: flag(review),
    DIAGNOSTIC: (review || missingPrice) ? diagnostic : '',
    REFERENCE_PATTERN: '',
    ROW_TYPE: 'EXISTING',
    PATRON: latest.Patron || '',
    CONFIRMADO_MANUAL: latest.Confirmado_Manual || '',
    TARIFA_NORMALIZADA_ID: latest.Tarifa_Normalizada_ID || '',
  };
}

function gapRow(station, exp, {
  status, category, missingCategory, missingStatus, diagnostic, reference,
}) {
  return {
    ...blankCatalogueBase(station, exp),
    STATUS: status,
    CATEGORY: category,
    IMPORTE: '',
    FECHA_APARICION: '',
    N_IMPORTES: '',
    HISTORIAL: '',
    MISSING_CATEGORY: flag(missingCategory),
    MISSING_PRICE: '',
    MISSING_STATUS: flag(missingStatus),
    REVIEW_REQUIRED: '',
    DIAGNOSTIC: diagnostic,
    REFERENCE_PATTERN: reference || '',
    ROW_TYPE: 'SUSPECTED_GAP',
    PATRON: '',
    CONFIRMADO_MANUAL: '',
    TARIFA_NORMALIZADA_ID: '',
  };
}

function pendingRow(station, exp, category, list) {
  const latest = latestOf(list);
  const importe = parseNum(latest.Importe);
  return {
    ...blankCatalogueBase(station, exp),
    STATUS: 'PENDIENTE',
    CATEGORY: category,
    IMPORTE: importe == null ? '' : importe,
    FECHA_APARICION: latest.fecha_aparicion || '',
    N_IMPORTES: list.length,
    HISTORIAL: historialOf(list),
    MISSING_CATEGORY: '',
    MISSING_PRICE: flag(importe == null),
    MISSING_STATUS: '',
    REVIEW_REQUIRED: 'TRUE',
    DIAGNOSTIC: 'Category exists only as PENDIENTE; PICO/NO_PICO not assigned yet.',
    REFERENCE_PATTERN: '',
    ROW_TYPE: 'EXISTING',
    PATRON: latest.Patron || '',
    CONFIRMADO_MANUAL: latest.Confirmado_Manual || '',
    TARIFA_NORMALIZADA_ID: latest.Tarifa_Normalizada_ID || '',
  };
}

function dualStatusExpected(exp) {
  return exp.expectedStatuses.includes('PICO') && exp.expectedStatuses.includes('NO_PICO');
}

function referenceForCategory(station, category) {
  const names = peersWithCategory(station.cluster, category, station.stationId);
  if (!names.length) return `${station.peaje} ${station.cluster.kind}: expected ${formatCategoryList(station.cluster.expectedCats)}`;
  return `${station.peaje} ${station.cluster.kind}: ${names.join(', ')} have ${category}`;
}

function emitGaps(station, exp, existingKeys, out) {
  const dual = dualStatusExpected(exp);
  for (const category of exp.expectedCats) {
    const hasPico = existingKeys.has(comboKey(station.peajeId, station.stationId, 'PICO', category));
    const hasOff = existingKeys.has(comboKey(station.peajeId, station.stationId, 'NO_PICO', category));

    if (!hasPico && !hasOff && shouldEmitMissingCategory(station, category, exp.expectedCats)) {
      const reference = referenceForCategory(station, category);
      if (dual) {
        out.push(gapRow(station, exp, {
          status: 'PICO',
          category,
          missingCategory: true,
          missingStatus: false,
          diagnostic: `Missing category ${category}`,
          reference,
        }));
        out.push(gapRow(station, exp, {
          status: 'NO_PICO',
          category,
          missingCategory: true,
          missingStatus: false,
          diagnostic: `Missing category ${category}, because have PICO and doesn't have NO_PICO`,
          reference,
        }));
      } else {
        out.push(gapRow(station, exp, {
          status: 'NO_PICO',
          category,
          missingCategory: true,
          missingStatus: false,
          diagnostic: `Missing category ${category}`,
          reference,
        }));
      }
      continue;
    }

    if (KNOWN_FLAT_STATIONS.has(station.station) && !station.confirmedPico) continue;
    if (!station.confirmedPico && exp.peakPeaje && station.peaje !== CORREDORES) continue;
    if (!dual) continue;

    if (hasPico && !hasOff) {
      out.push(gapRow(station, exp, {
        status: 'NO_PICO',
        category,
        missingCategory: false,
        missingStatus: true,
        diagnostic: `Missing category ${category}, because have PICO and doesn't have NO_PICO`,
        reference: `same station has PICO for category ${category}`,
      }));
    } else if (hasOff && !hasPico) {
      out.push(gapRow(station, exp, {
        status: 'PICO',
        category,
        missingCategory: false,
        missingStatus: true,
        diagnostic: `Missing category ${category}, because have NO_PICO and doesn't have PICO`,
        reference: `same station has NO_PICO for category ${category}`,
      }));
    }
  }
}

function sortCatalogue(a, b) {
  const peaje = String(a.PEAJE_NOMBRE).localeCompare(String(b.PEAJE_NOMBRE));
  if (peaje) return peaje;
  const st = String(a.STATION_NOMBRE).localeCompare(String(b.STATION_NOMBRE));
  if (st) return st;
  const cat = Number(a.CATEGORY) - Number(b.CATEGORY);
  if (cat) return cat;
  return STATUS_ORDER.indexOf(a.STATUS) - STATUS_ORDER.indexOf(b.STATUS);
}

function anyIssue(row) {
  return Boolean(row.MISSING_CATEGORY || row.MISSING_PRICE || row.MISSING_STATUS || row.REVIEW_REQUIRED);
}

export function classifyCatalogue(rows) {
  const stations = buildStations(rows);
  const clusters = clusterStations(stations);
  for (const c of clusters) estimateCluster(c);

  const { groups, pending } = collapseKeys(rows);
  const existingKeys = new Set(groups.keys());
  const catalogue = [];

  for (const [key, list] of groups) {
    const sample = list[0];
    const station = stations.get(stationKey(sample));
    const exp = expectedForStation(station, clusters, stations);
    const category = parseNum(sample.Categoria_Normalizada);
    catalogue.push(existingRow(station, exp, sample.Status, category, list));
  }

  for (const [pk, list] of pending) {
    const [peajeId, stationId, catStr] = pk.split('|');
    const hasConfirmed = existingKeys.has(comboKey(peajeId, stationId, 'PICO', Number(catStr)))
      || existingKeys.has(comboKey(peajeId, stationId, 'NO_PICO', Number(catStr)));
    if (hasConfirmed) continue;
    const station = stations.get(`${peajeId}|${stationId}`);
    const exp = expectedForStation(station, clusters, stations);
    catalogue.push(pendingRow(station, exp, Number(catStr), list));
  }

  for (const station of stations.values()) {
    const exp = expectedForStation(station, clusters, stations);
    emitGaps(station, exp, existingKeys, catalogue);
  }

  catalogue.sort(sortCatalogue);

  const summary = [...stations.values()]
    .map((station) => {
      const exp = expectedForStation(station, clusters, stations);
      const detectedCats = [...station.cats].sort((a, b) => a - b);
      const stationRows = catalogue.filter(
        (r) => r.PEAJE_ID === station.peajeId && r.STATION_ID === station.stationId,
      );
      const tariffs = stationRows.filter((r) => r.ROW_TYPE === 'EXISTING' && r.STATUS !== 'PENDIENTE').length;
      return {
        PEAJE_ID: station.peajeId,
        PEAJE_NOMBRE: station.peaje,
        STATION_ID: station.stationId,
        STATION_NOMBRE: station.station,
        cluster: station.cluster.kind,
        categories_detected: formatCategoryList(detectedCats),
        expected_categories: formatCategoryList(exp.expectedCats),
        categories_missing: categoriesMissing(exp.expectedCats, detectedCats),
        statuses_detected: formatStatusList([...station.statuses]),
        expected_statuses: formatStatusList(exp.expectedStatuses),
        statuses_missing: statusesMissing(exp.expectedStatuses, [...station.statuses]),
        min_category: detectedCats.length ? detectedCats[0] : '',
        max_category: detectedCats.length ? detectedCats[detectedCats.length - 1] : '',
        number_of_categories: detectedCats.length,
        number_of_tariffs: tariffs,
        issues_detected: stationRows.filter(anyIssue).length,
        modificated: '',
      };
    })
    .sort((a, b) => a.PEAJE_NOMBRE.localeCompare(b.PEAJE_NOMBRE)
      || a.STATION_NOMBRE.localeCompare(b.STATION_NOMBRE));

  const patterns = clusters.map((c) => ({
    PEAJE_ID: c.peajeId,
    PEAJE_NOMBRE: c.peaje,
    CLUSTER: c.kind,
    STATIONS: c.stations.map((s) => s.station).join(', '),
    STATION_COUNT: c.stations.length,
    EXPECTED_CATEGORIES: formatCategoryList(c.expectedCats),
    EXPECTED_STATUSES: formatStatusList(c.expectedStatuses),
  }));

  const history = rows.map((r) => ({ ...r }));

  const control = {
    source_rows: rows.length,
    catalogue_rows: catalogue.length,
    existing: catalogue.filter((r) => r.ROW_TYPE === 'EXISTING').length,
    suspected_gaps: catalogue.filter((r) => r.ROW_TYPE === 'SUSPECTED_GAP').length,
    missing_category: catalogue.filter((r) => r.MISSING_CATEGORY === 'TRUE').length,
    missing_status: catalogue.filter((r) => r.MISSING_STATUS === 'TRUE').length,
    missing_price: catalogue.filter((r) => r.MISSING_PRICE === 'TRUE').length,
    review_required: catalogue.filter((r) => r.REVIEW_REQUIRED === 'TRUE').length,
  };

  return { catalogue, summary, patterns, history, control };
}
