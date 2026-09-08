/** Pure peak/off-peak classifier for Patrón B families (station + category). */

export const TOLERANCIA_CLUSTER = 0.005;
export const TOLERANCIA_RATIO = 0.02;
export const SUBA_MAX = 0.15;
export const SPAN_DIA_COMPLETO = 18;

export function clusterImportes(niveles) {
  const sorted = [...niveles].sort((a, b) => a.importe - b.importe);
  const groups = [];
  for (const nivel of sorted) {
    const last = groups[groups.length - 1];
    if (
      last &&
      (nivel.importe - last.importeRepresentativo) / last.importeRepresentativo
        <= TOLERANCIA_CLUSTER
    ) {
      last.miembros.push(nivel);
      last.casos += nivel.casos ?? 0;
    } else {
      groups.push({
        importeRepresentativo: nivel.importe,
        casos: nivel.casos ?? 0,
        miembros: [nivel],
      });
    }
  }
  return groups;
}

export function familyRatio(importes) {
  if (!importes || importes.length < 2) return null;
  const min = Math.min(...importes);
  const max = Math.max(...importes);
  if (min <= 0) return null;
  return max / min;
}

export function ratioWithinTolerance(observed, reference, tolerance = TOLERANCIA_RATIO) {
  if (observed == null || reference == null || reference === 0) return false;
  return Math.abs(observed - reference) / reference <= tolerance;
}

export function monthlyIncreaseOk(earlier, later) {
  if (earlier == null || later == null || earlier <= 0) return false;
  const delta = (later - earlier) / earlier;
  return delta >= 0 && delta <= SUBA_MAX;
}

export function inheritByRank(monthLevels, julyLevels) {
  const monthRanked = [...monthLevels].sort((a, b) => a.importe - b.importe);
  const julyRanked = [...julyLevels].sort((a, b) => a.importe - b.importe);
  return monthRanked.map((nivel, i) => ({
    ...nivel,
    statusPropuesto: julyRanked[i]?.status ?? null,
  }));
}

export function derivePeakEnvelope(histogram) {
  const entries = Object.entries(histogram || {})
    .map(([h, n]) => ({ hora: Number(h), n: Number(n) }))
    .filter((e) => Number.isFinite(e.hora) && e.n > 0)
    .sort((a, b) => a.hora - b.hora);
  if (!entries.length) return null;
  const core = entries.filter((e) => e.n >= 2);
  const used = core.length ? core : entries;
  return {
    min: used[0].hora,
    max: used[used.length - 1].hora,
  };
}

export function classifyByHours({ horaMin, horaMax }, window) {
  if (window == null || horaMin == null || horaMax == null) {
    return { status: 'SIN_PROPUESTA', motivo: 'Sin ventana horaria' };
  }
  const span = horaMax - horaMin;
  if (span >= SPAN_DIA_COMPLETO || (horaMin <= 1 && horaMax >= 22)) {
    return { status: 'NO_PICO', motivo: 'Horas 0–23 (día completo)' };
  }
  if (horaMin >= window.min && horaMax <= window.max) {
    return { status: 'PICO', motivo: `Franja ${fmtHour(window.min)}–${fmtHour(window.max)}` };
  }
  return { status: 'SIN_PROPUESTA', motivo: 'Hora fuera de ventana pico' };
}

function fmtHour(n) {
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmtHours(min, max) {
  if (min == null || max == null) return '';
  return `${fmtHour(min)} – ${fmtHour(max)}`;
}

function uniqueStatuses(niveles) {
  return [...new Set(niveles.map((n) => n.status).filter(Boolean))];
}

function assignMaxIsPico(clustered) {
  const ranked = [...clustered].sort(
    (a, b) => a.importeRepresentativo - b.importeRepresentativo,
  );
  return ranked.map((group, i) => ({
    group,
    statusPropuesto: i === ranked.length - 1 ? 'PICO' : 'NO_PICO',
  }));
}

export function classifyFamilyMonth(familyMonth, julyRef, hourWindow, extras = {}) {
  const { niveles, peaje, estacion, categoria, mes } = familyMonth;
  const clustered = clusterImportes(niveles);
  const importes = clustered.map((g) => g.importeRepresentativo);
  const r = clustered.length >= 2
    ? familyRatio([Math.min(...importes), Math.max(...importes)])
    : null;
  const rJulio = julyRef?.r ?? null;
  const nextByRank = extras.nextByRank || [];
  const julyNiveles = julyRef?.niveles || [];
  const julyStatuses = uniqueStatuses(julyNiveles);
  const julyHasPair = julyStatuses.includes('PICO') && julyStatuses.includes('NO_PICO');
  const patronA = categoria == null || categoria === '';

  const rowBase = (nivel, extra) => ({
    peaje,
    estacion,
    categoria,
    mes,
    importe: nivel.importe,
    casos: nivel.casos,
    horaMin: nivel.horaMin,
    horaMax: nivel.horaMax,
    horas: fmtHours(nivel.horaMin, nivel.horaMax),
    r,
    rJulio,
    tarifaNormalizadaId: nivel.tarifaNormalizadaId ?? null,
    confirmar: '',
    ...extra,
  });

  if (patronA && clustered.length > 2) {
    return niveles.map((nivel) => {
      const hour = classifyByHours(nivel, hourWindow);
      if (hour.status === 'SIN_PROPUESTA') {
        return rowBase(nivel, {
          statusPropuesto: 'SIN_PROPUESTA',
          confianza: '—',
          motivo: 'Patrón A (sin categoría) · ' + hour.motivo,
        });
      }
      return rowBase(nivel, {
        statusPropuesto: hour.status,
        confianza: 'MEDIA',
        motivo: 'Patrón A (sin categoría) · ' + hour.motivo,
      });
    });
  }

  if (julyHasPair && clustered.length >= 2) {
    const assigned = assignMaxIsPico(clustered);
    const minImp = assigned[0].group.importeRepresentativo;
    const maxImp = assigned[assigned.length - 1].group.importeRepresentativo;
    const ratioOk = rJulio != null ? ratioWithinTolerance(maxImp / minImp, rJulio) : false;
    const laterMin = nextByRank[0];
    const laterMax = nextByRank[nextByRank.length - 1];
    const increaseOk = (laterMin == null || monthlyIncreaseOk(minImp, laterMin))
      && (laterMax == null || monthlyIncreaseOk(maxImp, laterMax));
    const alta = ratioOk && increaseOk;
    return assigned.flatMap(({ group, statusPropuesto }, i) => {
      const motivos = [
        statusPropuesto === 'PICO' ? `Tarifa mayor (${i + 1}/${assigned.length})` : `Tarifa menor/media (${i + 1}/${assigned.length})`,
        r != null ? `R ${r.toFixed(2)}` : null,
        ratioOk && rJulio != null ? `R julio ${rJulio.toFixed(2)}` : null,
        increaseOk ? 'suba mensual 0–15%' : null,
      ].filter(Boolean);
      return group.miembros.map((nivel) => rowBase(nivel, {
        statusPropuesto,
        confianza: alta ? 'ALTA' : 'MEDIA',
        motivo: alta
          ? motivos.join(' · ')
          : [...motivos, 'ratio o suba fuera de umbral'].join(' · '),
      }));
    });
  }

  if (julyStatuses.length === 1 && julyStatuses[0] === 'NO_PICO') {
    return niveles.map((nivel) => {
      const hour = classifyByHours(nivel, hourWindow);
      const allDay = hour.status === 'NO_PICO';
      return rowBase(nivel, {
        statusPropuesto: 'NO_PICO',
        confianza: allDay || nivel.casos >= 15 || clustered.length >= 1 ? 'ALTA' : 'MEDIA',
        motivo: clustered.length === 1 && allDay
          ? 'Nivel único · horas 0–23 · julio confirmó NO_PICO'
          : 'Julio confirmó solo NO_PICO',
      });
    });
  }

  if (julyStatuses.length === 1 && julyStatuses[0] === 'PICO') {
    return niveles.map((nivel) => rowBase(nivel, {
      statusPropuesto: 'PICO',
      confianza: 'MEDIA',
      motivo: 'Julio confirmó solo PICO',
    }));
  }

  return niveles.map((nivel) => {
    const hour = classifyByHours(nivel, hourWindow);
    if (hour.status === 'SIN_PROPUESTA') {
      return rowBase(nivel, {
        statusPropuesto: 'SIN_PROPUESTA',
        confianza: '—',
        motivo: hour.motivo,
      });
    }
    return rowBase(nivel, {
      statusPropuesto: hour.status,
      confianza: 'MEDIA',
      motivo: hour.motivo,
    });
  });
}

function familyKey(row) {
  return `${row.peaje}|${row.estacion}|${row.categoria ?? ''}`;
}

function groupByFamilyMonth(niveles) {
  const map = new Map();
  for (const row of niveles) {
    const key = `${familyKey(row)}|${row.mes}`;
    if (!map.has(key)) {
      map.set(key, {
        peaje: row.peaje,
        estacion: row.estacion,
        categoria: row.categoria,
        mes: row.mes,
        niveles: [],
      });
    }
    map.get(key).niveles.push(row);
  }
  return [...map.values()];
}

function buildJulyRefs(niveles, mesReferencia) {
  const refs = new Map();
  for (const row of niveles.filter((n) => n.mes === mesReferencia)) {
    const key = familyKey(row);
    if (!refs.has(key)) refs.set(key, []);
    refs.get(key).push({
      importe: row.importe,
      status: row.statusManual,
      casos: row.casos,
    });
  }
  const out = new Map();
  for (const [key, list] of refs) {
    const labeled = list.filter((n) => n.status === 'PICO' || n.status === 'NO_PICO');
    const used = labeled.length ? labeled : list;
    out.set(key, {
      niveles: used,
      r: familyRatio(used.map((n) => n.importe)),
    });
  }
  return out;
}

function nextMonthImportes(familyMonths, family, mes, mesReferencia) {
  const ranked = [...family.niveles].sort((a, b) => a.importe - b.importe);
  const later = familyMonths
    .filter((f) => f.peaje === family.peaje
      && f.estacion === family.estacion
      && f.categoria === family.categoria
      && f.mes > mes
      && f.mes <= mesReferencia)
    .sort((a, b) => a.mes.localeCompare(b.mes))[0];
  if (!later) return ranked.map(() => null);
  const laterRanked = [...later.niveles].sort((a, b) => a.importe - b.importe);
  if (laterRanked.length !== ranked.length) {
    return ranked.map((n) => {
      const match = laterRanked.find((l) => monthlyIncreaseOk(n.importe, l.importe)
        || Math.abs(l.importe - n.importe) / n.importe <= 0.02);
      return match ? match.importe : null;
    });
  }
  return laterRanked.map((n) => n.importe);
}

export function validateJulyBlind(families, hourWindow) {
  let total = 0;
  let coincidencias = 0;
  for (const family of families) {
    const clustered = clusterImportes(family.niveles);
    const labeled = family.niveles.filter((n) => n.statusManual === 'PICO' || n.statusManual === 'NO_PICO');
    const statuses = [...new Set(labeled.map((n) => n.statusManual))];
    const patronB = family.niveles.every((n) => n.categoria != null && n.categoria !== '');
    if (patronB && clustered.length >= 2 && statuses.includes('PICO') && statuses.includes('NO_PICO')) {
      const ranked = [...family.niveles].sort((a, b) => a.importe - b.importe);
      ranked.forEach((n, i) => {
        if (!n.statusManual) return;
        total += 1;
        const proposed = i === ranked.length - 1 ? 'PICO' : 'NO_PICO';
        if (n.statusManual === proposed) coincidencias += 1;
      });
      continue;
    }
    if (statuses.length === 1 && statuses[0] === 'NO_PICO') {
      for (const nivel of labeled) {
        total += 1;
        if (nivel.statusManual === 'NO_PICO') coincidencias += 1;
      }
      continue;
    }
    for (const nivel of labeled) {
      total += 1;
      const hour = classifyByHours(nivel, hourWindow);
      if (hour.status === nivel.statusManual) coincidencias += 1;
    }
  }
  const pct = total === 0 ? 0 : Math.round((coincidencias / total) * 1000) / 10;
  return { total, coincidencias, pct };
}

export function classifyAll({ niveles, histogramasPico, mesReferencia = '2026-07' }) {
  const familyMonths = groupByFamilyMonth(niveles);
  const julyRefs = buildJulyRefs(niveles, mesReferencia);
  const envelopes = {};
  for (const [peaje, hist] of Object.entries(histogramasPico || {})) {
    envelopes[peaje] = derivePeakEnvelope(hist);
  }

  const propuesta = [];
  for (const family of familyMonths) {
    const key = familyKey(family);
    const julyRef = julyRefs.get(key) || { niveles: [], r: null };
    const window = envelopes[family.peaje] || null;
    const nextByRank = nextMonthImportes(familyMonths, family, family.mes, mesReferencia);
    let rows = classifyFamilyMonth(family, julyRef, window, { nextByRank });
    if (family.mes === mesReferencia) {
      rows = rows.map((row) => {
        const nivel = family.niveles.find((n) => n.tarifaNormalizadaId
          && n.tarifaNormalizadaId === row.tarifaNormalizadaId)
          || family.niveles.find((n) => n.importe === row.importe);
        const manual = nivel?.statusManual;
        if (manual === 'PICO' || manual === 'NO_PICO') {
          return {
            ...row,
            statusPropuesto: manual,
            confianza: 'ALTA',
            motivo: 'Referencia julio (confirmado a mano)',
          };
        }
        return row;
      });
    }
    propuesta.push(...rows);
  }

  propuesta.sort((a, b) => a.peaje.localeCompare(b.peaje)
    || a.estacion.localeCompare(b.estacion)
    || String(a.categoria).localeCompare(String(b.categoria))
    || a.mes.localeCompare(b.mes)
    || a.importe - b.importe);

  const julyFamilies = familyMonths.filter((f) => f.mes === mesReferencia).map((f) => ({
    ...f,
    niveles: f.niveles.map((n) => ({
      ...n,
      statusManual: n.statusManual,
    })),
  }));
  const byPeaje = {};
  let total = 0;
  let coincidencias = 0;
  for (const family of julyFamilies) {
    const patronB = family.niveles.every((n) => n.categoria != null && n.categoria !== '');
    if (!patronB) continue;
    const window = envelopes[family.peaje] || null;
    const report = validateJulyBlind([family], window);
    total += report.total;
    coincidencias += report.coincidencias;
    if (!byPeaje[family.peaje]) byPeaje[family.peaje] = { total: 0, coincidencias: 0 };
    byPeaje[family.peaje].total += report.total;
    byPeaje[family.peaje].coincidencias += report.coincidencias;
  }
  const pct = total === 0 ? 0 : Math.round((coincidencias / total) * 1000) / 10;

  const ratiosRef = [...julyRefs.entries()].map(([key, ref]) => {
    const [peaje, estacion, categoria] = key.split('|');
    return {
      peaje,
      estacion,
      categoria,
      r: ref.r,
      niveles: ref.niveles.length,
    };
  }).sort((a, b) => a.peaje.localeCompare(b.peaje)
    || a.estacion.localeCompare(b.estacion)
    || String(a.categoria).localeCompare(String(b.categoria)));

  return {
    propuesta,
    control: {
      julio: { total, coincidencias, pct, porPeaje: byPeaje },
      envelopes,
      ratiosRef,
    },
  };
}
