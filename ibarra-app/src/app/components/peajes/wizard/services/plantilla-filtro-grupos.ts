import { ConfiguracionPlantilla, PlantillaConfiguracion } from '../../models';

export interface PlantillaFiltroOpcion {
  plantillaId: string;
  valor: string;
  label: string;
}

export interface PlantillaFiltroGrupo {
  /** Id de la plantilla representativa (primera variante). */
  id: string;
  label: string;
  opciones: PlantillaFiltroOpcion[];
}

export interface PlantillasAgrupadas {
  grupos: PlantillaFiltroGrupo[];
  sueltas: PlantillaConfiguracion[];
}

const ALGORITMO_FILTRO = 'FILTRAR_COLUMNA';

export function agruparPlantillasPorFiltro(
  plantillas: readonly PlantillaConfiguracion[],
): PlantillasAgrupadas {
  const buckets = new Map<string, PlantillaConfiguracion[]>();
  const sueltas: PlantillaConfiguracion[] = [];

  for (const plantilla of plantillas) {
    const filtros = configuracionesFiltro(plantilla);
    if (filtros.length !== 1 || !valorFiltro(filtros[0])) {
      sueltas.push(plantilla);
      continue;
    }
    const key = `${plantilla.empresa_id}::${firmaSinValorFiltro(plantilla)}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(plantilla);
    buckets.set(key, bucket);
  }

  const grupos: PlantillaFiltroGrupo[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) {
      sueltas.push(...bucket);
      continue;
    }
    const ordenadas = [...bucket].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const prefix = prefijoComun(ordenadas.map((p) => p.nombre));
    grupos.push({
      id: ordenadas[0].id,
      label: prefix || ordenadas[0].nombre,
      opciones: ordenadas.map((plantilla) => {
        const valor = valorFiltro(configuracionesFiltro(plantilla)[0]) ?? '';
        const resto = plantilla.nombre
          .slice(prefix.length)
          .replace(/^[-_\s]+/, '')
          .replace(/^\d+[-_\s]*/, '')
          .replace(/-/g, ' ')
          .trim();
        return {
          plantillaId: plantilla.id,
          valor,
          label: resto ? `${valor} · ${resto}` : valor,
        };
      }),
    });
  }

  grupos.sort((a, b) => a.label.localeCompare(b.label, 'es'));
  sueltas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return { grupos, sueltas };
}

export function aplicarValoresFiltro(
  plantilla: PlantillaConfiguracion,
  valores: readonly string[],
): PlantillaConfiguracion {
  const limpios = valores.map((v) => v.trim()).filter((v) => v.length > 0);
  if (!limpios.length) return plantilla;
  const valor: string | string[] = limpios.length === 1 ? limpios[0] : [...limpios];
  return {
    ...plantilla,
    configuraciones: (plantilla.configuraciones ?? []).map((cfg) => {
      if (cfg.configuracion?.['algoritmo_codigo'] !== ALGORITMO_FILTRO) return cfg;
      const parametros =
        cfg.configuracion['parametros'] && typeof cfg.configuracion['parametros'] === 'object'
          ? { ...(cfg.configuracion['parametros'] as Record<string, unknown>), valor }
          : { valor };
      return {
        ...cfg,
        configuracion: {
          ...cfg.configuracion,
          valor,
          parametros,
        },
      };
    }),
  };
}

function configuracionesFiltro(plantilla: PlantillaConfiguracion): ConfiguracionPlantilla[] {
  return (plantilla.configuraciones ?? []).filter(
    (cfg) => cfg.configuracion?.['algoritmo_codigo'] === ALGORITMO_FILTRO,
  );
}

function valorFiltro(cfg: ConfiguracionPlantilla | undefined): string | null {
  if (!cfg?.configuracion) return null;
  const directo = cfg.configuracion['valor'];
  const anidado =
    cfg.configuracion['parametros'] && typeof cfg.configuracion['parametros'] === 'object'
      ? (cfg.configuracion['parametros'] as Record<string, unknown>)['valor']
      : undefined;
  const raw = directo ?? anidado;
  if (raw == null || Array.isArray(raw)) return null;
  const texto = String(raw).trim();
  return texto || null;
}

function firmaSinValorFiltro(plantilla: PlantillaConfiguracion): string {
  const configs = [...(plantilla.configuraciones ?? [])]
    .sort((a, b) => a.orden - b.orden)
    .map((cfg) => ({
      orden: cfg.orden,
      tipo: cfg.tipo,
      nombre_columna: cfg.nombre_columna,
      columna_destino: cfg.columna_destino ?? null,
      configuracion: sinValorFiltro(cfg.configuracion),
    }));
  return JSON.stringify({
    estrategia: plantilla.estrategia_codigo ?? null,
    configs,
    mapeos: plantilla.mapeos ?? [],
  });
}

function sinValorFiltro(
  configuracion: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!configuracion) return null;
  if (configuracion['algoritmo_codigo'] !== ALGORITMO_FILTRO) return configuracion;
  const copia: Record<string, unknown> = { ...configuracion };
  delete copia['valor'];
  if (copia['parametros'] && typeof copia['parametros'] === 'object') {
    const parametros = { ...(copia['parametros'] as Record<string, unknown>) };
    delete parametros['valor'];
    copia['parametros'] = parametros;
  }
  return copia;
}

function prefijoComun(nombres: string[]): string {
  if (!nombres.length) return '';
  const partes = nombres.map((nombre) => nombre.split(/[-_\s]+/).filter(Boolean));
  const limite = Math.min(...partes.map((parte) => parte.length));
  const comunes: string[] = [];
  for (let i = 0; i < limite; i += 1) {
    const token = partes[0][i];
    if (!partes.every((parte) => parte[i] === token)) break;
    comunes.push(token);
  }
  if (!comunes.length) return nombres[0];
  if (comunes.length === partes[0].length) return nombres[0];
  return comunes.join('-');
}
