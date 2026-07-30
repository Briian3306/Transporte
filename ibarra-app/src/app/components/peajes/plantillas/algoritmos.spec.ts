import { firstValueFrom } from 'rxjs';
import { crearMotor } from './motor/peajes-motor-transformacion.service';
import { PeajesPlantillasMockService } from './mocks/peajes-plantillas.mock';
import { validarPublicacionAlgoritmo } from './validacion/plantillas-validacion';

describe('peajes/plantillas/algoritmos', () => {
  it('no permite referenciar códigos no registrados en StrategyRegistry', async () => {
    const motor = crearMotor();
    const result = validarPublicacionAlgoritmo(
      { nombre: 'MALO', empresa_id: 'e1' },
      [{ orden: 1, algoritmo_codigo: 'HACKEAR_SQL' }],
      motor.getRegistry()
    );
    expect(result.ok).toBeFalse();
    expect(result.errores.some((e) => /no registrados/i.test(e.motivo))).toBeTrue();

    expect(() =>
      motor.expandirAlgoritmo({
        id: 'x',
        nombre: 'x',
        empresa_id: 'e1',
        estado: 'borrador',
        pasos: [
          {
            id: '1',
            algoritmo_combinado_id: 'x',
            orden: 1,
            algoritmo_codigo: 'NO_EXISTE',
          },
        ],
      })
    ).toThrowError(/no registrado/i);
  });

  it('NORMALIZAR_PATENTE expande BORRAR_ESPACIOS + ELIMINAR_GUIONES + CONVERTIR_MAYUSCULAS', async () => {
    const svc = new PeajesPlantillasMockService();
    svc.reset();
    const motor = crearMotor();

    const pasos = await firstValueFrom(svc.expandirAlgoritmo('alg-normalizar-patente'));
    expect(pasos.map((p) => p.algoritmo_codigo)).toEqual([
      'BORRAR_ESPACIOS',
      'ELIMINAR_GUIONES',
      'CONVERTIR_MAYUSCULAS',
    ]);

    const alg = (await firstValueFrom(svc.listarAlgoritmos())).find(
      (a) => a.id === 'alg-normalizar-patente'
    )!;
    const efectivos = motor.expandirAlgoritmo(alg);
    expect(efectivos.map((p) => p.algoritmoCodigo)).toEqual([
      'BORRAR_ESPACIOS',
      'ELIMINAR_GUIONES',
      'CONVERTIR_MAYUSCULAS',
    ]);
  });

  it('bloquea publicación con orden duplicado o columna/paso inválido (F03-7)', () => {
    const motor = crearMotor();
    const dup = validarPublicacionAlgoritmo(
      { nombre: 'DUP', empresa_id: 'e1' },
      [
        { orden: 1, algoritmo_codigo: 'BORRAR_ESPACIOS' },
        { orden: 1, algoritmo_codigo: 'ELIMINAR_GUIONES' },
      ],
      motor.getRegistry()
    );
    expect(dup.ok).toBeFalse();
    expect(dup.errores.some((e) => /orden duplicado/i.test(e.motivo))).toBeTrue();

    const vacio = validarPublicacionAlgoritmo(
      { nombre: 'VACIO', empresa_id: 'e1' },
      [],
      motor.getRegistry()
    );
    expect(vacio.ok).toBeFalse();
  });

  it('guardar algoritmo combinado válido', async () => {
    const svc = new PeajesPlantillasMockService();
    const saved = await firstValueFrom(
      svc.guardarAlgoritmo(
        {
          nombre: 'LIMPIAR_TEXTO',
          descripcion: 'trim + upper',
          empresa_id: 'empresa-demo',
          estado: 'activa',
        },
        [
          { orden: 1, algoritmo_codigo: 'BORRAR_ESPACIOS' },
          { orden: 2, algoritmo_codigo: 'CONVERTIR_MAYUSCULAS' },
        ]
      )
    );
    expect(saved.pasos?.length).toBe(2);
    expect(saved.nombre).toBe('LIMPIAR_TEXTO');
  });
});
