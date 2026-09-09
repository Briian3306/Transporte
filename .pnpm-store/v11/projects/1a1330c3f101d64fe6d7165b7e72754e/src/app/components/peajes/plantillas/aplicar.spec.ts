import { crearMotor } from './motor/peajes-motor-transformacion.service';
import {
  COLUMNAS_ARCHIVO_DEMO,
  PeajesPlantillasMockService,
  buildPlantillaDemoProveedor,
} from './mocks/peajes-plantillas.mock';
import { puedeAplicarRecurso, filtrarPorEmpresa } from './validacion/plantillas-validacion';
import { GLOBAL_EMPRESA_ID } from './mocks/peajes-plantillas.mock';

describe('peajes/plantillas/aplicar', () => {
  it('informa columnas faltantes requeridas antes de aplicar (RF-13)', () => {
    const motor = crearMotor();
    const plantilla = buildPlantillaDemoProveedor(
      'alg-normalizar-patente',
      'alg-combinar-fecha-hora'
    );
    const columnasIncompletas = ['FECHA', 'DOMINIO']; // faltan HORA, DISPOSITIVON, etc.
    const errores = motor.validarCompatibilidad(
      plantilla.configuraciones ?? [],
      columnasIncompletas
    );
    expect(errores.length).toBeGreaterThan(0);
    expect(errores.some((e) => /faltante|requerida/i.test(e.motivo))).toBeTrue();
  });

  it('permite aplicar cuando el archivo tiene las columnas de la plantilla demo', () => {
    const motor = crearMotor();
    const plantilla = buildPlantillaDemoProveedor(
      'alg-normalizar-patente',
      'alg-combinar-fecha-hora'
    );
    const errores = motor.validarCompatibilidad(
      plantilla.configuraciones ?? [],
      COLUMNAS_ARCHIVO_DEMO
    );
    expect(errores.length).toBe(0);
  });

  it('alcance por empresa: plantilla A no aplica a empresa B salvo global (F03-8)', () => {
    expect(puedeAplicarRecurso('empresa-a', 'empresa-b')).toBeFalse();
    expect(puedeAplicarRecurso('empresa-a', 'empresa-a')).toBeTrue();
    expect(puedeAplicarRecurso(GLOBAL_EMPRESA_ID, 'empresa-b')).toBeTrue();

    const items = [
      { id: '1', empresa_id: 'empresa-a', nombre: 'A' },
      { id: '2', empresa_id: 'empresa-b', nombre: 'B' },
      { id: '3', empresa_id: GLOBAL_EMPRESA_ID, nombre: 'Global' },
    ];
    const filtrados = filtrarPorEmpresa(items, 'empresa-a');
    expect(filtrados.map((i) => i.id)).toEqual(['1', '3']);
  });

  it('listarPlantillas filtra por empresa e incluye globales', (done) => {
    const svc = new PeajesPlantillasMockService();
    svc.reset();
    svc
      .guardarPlantilla(
        {
          nombre: 'Solo B',
          empresa_id: 'empresa-b',
          estado: 'activa',
        },
        []
      )
      .subscribe(() => {
        svc.listarPlantillas('empresa-demo').subscribe((list) => {
          expect(list.every((p) => p.empresa_id === 'empresa-demo' || p.empresa_id === GLOBAL_EMPRESA_ID)).toBeTrue();
          expect(list.some((p) => p.nombre === 'Solo B')).toBeFalse();
          done();
        });
      });
  });
});
