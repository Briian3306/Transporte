import {
  AUDITORIA_ESTACIONES_ALGORITMO_VERSION,
  ESTADOS_CASO_AUDITORIA_ESTACION,
  HALLAZGOS_AUDITORIA_ESTACION,
  PEAJES_AUDITORIA_ESTACIONES_LISTAR_RPC,
  puedeTransicionarCasoEstacion,
  claveRelacionEstacion,
  fingerprintCasoEstacion,
} from './auditoria-estaciones.contracts';

describe('F16-0 contrato auditoría de estaciones', () => {
  it('publica el token RPC de listado y los hallazgos cerrados', () => {
    expect(PEAJES_AUDITORIA_ESTACIONES_LISTAR_RPC).toBe('peajes_listar_auditoria_estaciones');
    expect(HALLAZGOS_AUDITORIA_ESTACION).toEqual([
      'CODIGO_REPETIDO_ENTRE_ESTACIONES',
      'SECUENCIA_NUMERICA_CON_SALTO',
      'SECUENCIA_NUMERICA_INVERTIDA',
      'ALIAS_DIFERENTE_CATALOGO',
    ]);
    expect(ESTADOS_CASO_AUDITORIA_ESTACION).toEqual([
      'PENDIENTE',
      'VALIDADO',
      'DESCARTADO',
      'REQUIERE_CORRECCION',
      'CORREGIDO',
    ]);
    expect(AUDITORIA_ESTACIONES_ALGORITMO_VERSION).toBe('v1');
  });

  it('resuelve la clave canónica de relación 0001=1 y 3=0003', () => {
    expect(claveRelacionEstacion('0001')).toBe('1');
    expect(claveRelacionEstacion('1')).toBe('1');
    expect(claveRelacionEstacion('0003')).toBe('3');
    expect(claveRelacionEstacion('3')).toBe('3');
    expect(claveRelacionEstacion('A01')).toBe('A01');
  });

  it('rechaza transiciones de caso desconocidas', () => {
    expect(puedeTransicionarCasoEstacion('PENDIENTE', 'VALIDADO')).toBeTrue();
    expect(puedeTransicionarCasoEstacion('PENDIENTE', 'DESCARTADO')).toBeTrue();
    expect(puedeTransicionarCasoEstacion('PENDIENTE', 'REQUIERE_CORRECCION')).toBeTrue();
    expect(puedeTransicionarCasoEstacion('REQUIERE_CORRECCION', 'CORREGIDO')).toBeTrue();
    expect(puedeTransicionarCasoEstacion('VALIDADO', 'PENDIENTE')).toBeFalse();
    expect(puedeTransicionarCasoEstacion('PENDIENTE', 'INVENTADO')).toBeFalse();
  });

  it('arma fingerprint estable por empresa, peaje, tipo y códigos normalizados', () => {
    const a = fingerprintCasoEstacion({
      empresaId: 'emp',
      peajeId: 'peaje',
      tipo: 'SECUENCIA_NUMERICA_CON_SALTO',
      codigosNormalizados: ['5', '1', '0003', '2'],
    });
    const b = fingerprintCasoEstacion({
      empresaId: 'emp',
      peajeId: 'peaje',
      tipo: 'SECUENCIA_NUMERICA_CON_SALTO',
      codigosNormalizados: ['1', '2', '3', '5'],
    });
    expect(a).toBe(b);
    expect(a).toContain('v1');
  });
});
