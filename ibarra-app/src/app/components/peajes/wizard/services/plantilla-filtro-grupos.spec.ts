import { PlantillaConfiguracion } from '../../models';
import { agruparPlantillasPorFiltro, aplicarValoresFiltro } from './plantilla-filtro-grupos';

function merca(id: string, nombre: string, valor: string): PlantillaConfiguracion {
  return {
    id,
    nombre,
    empresa_id: 'emp-mercosur',
    estado: 'activa',
    configuraciones: [
      {
        id: `${id}-fecha`,
        plantilla_id: id,
        nombre_columna: 'FECHA',
        orden: 10,
        tipo: 'transformacion',
        configuracion: { algoritmo_codigo: 'FORMATEAR_FECHA_HORA', columnas: ['FECHA', 'HORA'] },
        obligatoria: false,
      },
      {
        id: `${id}-filtro`,
        plantilla_id: id,
        nombre_columna: 'ESTACION',
        orden: 100,
        tipo: 'transformacion',
        configuracion: {
          algoritmo_codigo: 'FILTRAR_COLUMNA',
          columna: 'ESTACION',
          valor,
          parametros: { columna: 'ESTACION', valor },
        },
        obligatoria: false,
      },
    ],
  };
}

describe('agruparPlantillasPorFiltro', () => {
  it('une MERCA-SUR cuando solo cambia el filtro', () => {
    const agrupadas = agruparPlantillasPorFiltro([
      merca('p1', 'MERCA-SUR-001-ZARATE', '0001'),
      merca('p2', 'MERCA-SUR-002-COLONIA', '0002'),
      merca('p3', 'MERCA-SUR-003-YERAU', '0003'),
    ]);

    expect(agrupadas.sueltas).toEqual([]);
    expect(agrupadas.grupos.length).toBe(1);
    expect(agrupadas.grupos[0].label).toBe('MERCA-SUR');
    expect(agrupadas.grupos[0].opciones.map((o) => o.valor)).toEqual(['0001', '0002', '0003']);
  });

  it('deja suelta una plantilla sin filtro compartido', () => {
    const suelta: PlantillaConfiguracion = {
      id: 'ausol',
      nombre: 'AUSOL',
      empresa_id: 'emp-1',
      estado: 'activa',
      configuraciones: [],
    };
    const agrupadas = agruparPlantillasPorFiltro([
      suelta,
      merca('p1', 'MERCA-SUR-001-ZARATE', '0001'),
    ]);
    expect(agrupadas.grupos).toEqual([]);
    expect(agrupadas.sueltas.map((p) => p.id)).toEqual(['ausol', 'p1']);
  });
});

describe('aplicarValoresFiltro', () => {
  it('reemplaza el valor único o la lista de filtros', () => {
    const base = merca('p1', 'MERCA-SUR-001-ZARATE', '0001');
    const uno = aplicarValoresFiltro(base, ['0002']);
    expect(uno.configuraciones?.[1].configuracion?.['valor']).toBe('0002');

    const varios = aplicarValoresFiltro(base, ['0001', '0003']);
    expect(varios.configuraciones?.[1].configuracion?.['valor']).toEqual(['0001', '0003']);
    const parametros = varios.configuraciones?.[1].configuracion?.['parametros'] as {
      valor: string[];
    };
    expect(parametros.valor).toEqual(['0001', '0003']);
  });
});
