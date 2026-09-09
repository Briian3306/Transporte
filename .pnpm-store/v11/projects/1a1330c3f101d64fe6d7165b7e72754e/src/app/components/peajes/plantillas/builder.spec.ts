import { firstValueFrom } from 'rxjs';
import { PeajesPlantillasMockService } from './mocks/peajes-plantillas.mock';
import { crearMotor } from './motor/peajes-motor-transformacion.service';
import { validarPublicacionPlantilla } from './validacion/plantillas-validacion';

describe('peajes/plantillas/builder', () => {
  it('guardar plantilla persiste nombre, descripción, empresa_id, estado', async () => {
    const svc = new PeajesPlantillasMockService();
    svc.reset();

    const saved = await firstValueFrom(
      svc.guardarPlantilla(
        {
          nombre: 'Plantilla Test',
          descripcion: 'Desc test',
          empresa_id: 'empresa-a',
          estado: 'borrador',
        },
        [
          {
            nombre_columna: 'DOMINIO',
            columna_destino: 'PATENTE_ID',
            orden: 10,
            tipo: 'mapeo',
            configuracion: { algoritmo_codigo: 'COPIAR_COLUMNA', columna: 'DOMINIO' },
            obligatoria: true,
          },
        ]
      )
    );

    expect(saved.nombre).toBe('Plantilla Test');
    expect(saved.descripcion).toBe('Desc test');
    expect(saved.empresa_id).toBe('empresa-a');
    expect(saved.estado).toBe('borrador');
    expect(saved.configuraciones?.length).toBe(1);

    const loaded = await firstValueFrom(svc.obtenerPlantilla(saved.id));
    expect(loaded?.nombre).toBe('Plantilla Test');
    expect(loaded?.empresa_id).toBe('empresa-a');
  });

  it('editar y guardar reemplaza configuraciones en una sola operación (F03-3)', async () => {
    const svc = new PeajesPlantillasMockService();
    svc.reset();

    const created = await firstValueFrom(
      svc.guardarPlantilla(
        {
          nombre: 'Overwrite',
          empresa_id: 'empresa-a',
          estado: 'borrador',
        },
        [
          {
            nombre_columna: 'A',
            orden: 10,
            tipo: 'mapeo',
            obligatoria: true,
            configuracion: { algoritmo_codigo: 'COPIAR_COLUMNA', columna: 'A' },
          },
          {
            nombre_columna: 'B',
            orden: 20,
            tipo: 'mapeo',
            obligatoria: false,
            configuracion: { algoritmo_codigo: 'COPIAR_COLUMNA', columna: 'B' },
          },
        ]
      )
    );

    expect(created.configuraciones?.length).toBe(2);

    const nuevas = await firstValueFrom(
      svc.sobrescribirConfiguraciones(created.id, [
        {
          nombre_columna: 'C',
          orden: 5,
          tipo: 'transformacion',
          obligatoria: true,
          configuracion: { algoritmo_codigo: 'CONVERTIR_TEXTO', columna: 'C' },
        },
      ])
    );

    expect(nuevas.length).toBe(1);
    expect(nuevas[0].nombre_columna).toBe('C');

    const loaded = await firstValueFrom(svc.obtenerPlantilla(created.id));
    expect(loaded?.configuraciones?.length).toBe(1);
    expect(loaded?.configuraciones?.[0].nombre_columna).toBe('C');
  });

  it('validación de publicación bloquea orden duplicado', () => {
    const motor = crearMotor();
    const result = validarPublicacionPlantilla(
      { nombre: 'X', empresa_id: 'e1', estado: 'activa' },
      [
        {
          nombre_columna: 'A',
          orden: 10,
          tipo: 'mapeo',
          obligatoria: true,
          configuracion: { algoritmo_codigo: 'COPIAR_COLUMNA' },
        },
        {
          nombre_columna: 'B',
          orden: 10,
          tipo: 'mapeo',
          obligatoria: true,
          configuracion: { algoritmo_codigo: 'COPIAR_COLUMNA' },
        },
      ],
      motor.getRegistry()
    );
    expect(result.ok).toBeFalse();
    expect(result.errores.some((e) => /orden duplicado/i.test(e.motivo))).toBeTrue();
  });
});
