/** has_pico stations must have the same category set on PICO and NO_PICO. */

function uniqueSorted(cats) {
  return [...new Set((cats || []).map(Number).filter((n) => Number.isFinite(n)))]
    .sort((a, b) => a - b);
}

function formatList(cats) {
  return uniqueSorted(cats).join(',');
}

export function assertPicoNoPicoSameCategories(station) {
  const pico = uniqueSorted(station.picoCats);
  const noPico = uniqueSorted(station.noPicoCats);
  const result = {
    ok: true,
    pico: formatList(pico),
    no_pico: formatList(noPico),
    peaje_nombre: station.peaje_nombre ?? '',
    estacion_nombre: station.estacion_nombre ?? '',
  };
  if (station.cluster !== 'has_pico') return result;
  const same = pico.length === noPico.length && pico.every((c, i) => c === noPico[i]);
  if (!same) result.ok = false;
  return result;
}

export function stationsFromTarifasAndSummary(tarifas, summary) {
  const byStation = new Map();
  for (const row of tarifas) {
    const key = `${row.peaje_id}|${row.estacion_id}`;
    if (!byStation.has(key)) {
      byStation.set(key, {
        peaje_id: row.peaje_id,
        estacion_id: row.estacion_id,
        peaje_nombre: row.peaje_nombre,
        estacion_nombre: row.estacion_nombre,
        picoCats: [],
        noPicoCats: [],
        cluster: 'flat',
      });
    }
    const s = byStation.get(key);
    const cat = Number(row.categoria);
    if (row.status === 'PICO') s.picoCats.push(cat);
    if (row.status === 'NO_PICO') s.noPicoCats.push(cat);
    if (row.status === 'PICO') s.cluster = 'has_pico';
  }
  for (const sum of summary || []) {
    const key = `${sum.peaje_id}|${sum.estacion_id}`;
    const s = byStation.get(key);
    if (!s) continue;
    const modificated = String(sum.modificated || '').toUpperCase() === 'TRUE';
    if (modificated && sum.cluster) s.cluster = sum.cluster;
  }
  return [...byStation.values()];
}

export function symmetryBlockers(tarifas, summary) {
  return stationsFromTarifasAndSummary(tarifas, summary)
    .map((s) => assertPicoNoPicoSameCategories(s))
    .filter((r) => !r.ok);
}
