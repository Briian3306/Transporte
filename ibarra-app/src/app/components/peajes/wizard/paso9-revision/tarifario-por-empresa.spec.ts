import { pasosTarifarioPorEmpresa } from './tarifario-por-empresa';

describe('pasosTarifarioPorEmpresa', () => {
  it('shows a NULL-company toll in every company', () => {
    const pasos = pasosTarifarioPorEmpresa({
      empresaIds: ['emp-a', 'emp-b'],
      empresas: [],
      peajes: [{ id: 'shared', empresa_id: null }],
      candidatos: [{ peajeId: 'shared' }],
      resultados: [{ codigo: 'NEW_TARIFF', peajeId: 'shared' }],
    });
    expect(pasos.map((paso) => paso.estado)).toEqual(['pendiente', 'pendiente']);
  });

  it('does not count an unknown toll as a shared toll', () => {
    const pasos = pasosTarifarioPorEmpresa({
      empresaIds: ['emp-a'], empresas: [], peajes: [],
      candidatos: [{ peajeId: 'unknown' }],
      resultados: [{ codigo: 'NEW_TARIFF', peajeId: 'unknown' }],
    });
    expect(pasos[0].estado).toBe('vacio');
  });

  const empresas = [
    { id: 'emp-a', nombre: 'Ausol' },
    { id: 'emp-b', nombre: 'Aubasa' },
  ];
  const peajes = [
    { id: 'p-a', empresa_id: 'emp-a' },
    { id: 'p-b', empresa_id: 'emp-b' },
  ];

  it('arma un paso por empresa y omite la que no está en los documentos', () => {
    const pasos = pasosTarifarioPorEmpresa({
      empresaIds: ['emp-a', 'emp-b'],
      empresas,
      peajes,
      candidatos: [{ peajeId: 'p-a' }],
      resultados: [
        { codigo: 'NEW_TARIFF', peajeId: 'p-a' },
        { codigo: 'NEW_TARIFF', peajeId: 'p-otra' },
      ],
    });

    expect(pasos.map((paso) => paso.nombre)).toEqual(['Ausol', 'Aubasa']);
    expect(pasos[0].estado).toBe('pendiente');
    expect(pasos[1].estado).toBe('vacio');
    expect(pasos.map((paso) => paso.numero)).toEqual([1, 2]);
  });

  it('marca completo y revisar según los resultados de esa empresa', () => {
    const pasos = pasosTarifarioPorEmpresa({
      empresaIds: ['emp-a', 'emp-b'],
      empresas,
      peajes,
      candidatos: [{ peajeId: 'p-a' }, { peajeId: 'p-b' }],
      resultados: [
        { codigo: 'CURRENT_TARIFF', peajeId: 'p-a' },
        { codigo: 'REVIEW_RECORDED', peajeId: 'p-b' },
      ],
    });

    expect(pasos[0].estado).toBe('completo');
    expect(pasos[1].estado).toBe('revisar');
  });
});
