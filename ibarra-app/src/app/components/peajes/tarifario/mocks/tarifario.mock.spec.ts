import { firstValueFrom } from 'rxjs';
import { buildEditorRows as buildRows } from '../tarifario.helpers';
import {
  ESTACION_BERNAL,
  ESTACION_HUDSON,
  ESTACION_INCOMPLETA,
  ESTACION_VACIA,
  PEAJE_AUBASA,
  TI_099,
  TI_100,
  TarifarioMockService,
} from './tarifario.mock';

describe('TarifarioMockService', () => {
  let mock: TarifarioMockService;

  beforeEach(() => {
    mock = new TarifarioMockService();
  });

  it('lista solo importes actuales, no todo el historial', async () => {
    const result = await firstValueFrom(mock.listar({ page: 1, pageSize: 100 }));
    const hudsonIdaCat1 = result.rows.find(
      (r) =>
        r.estacion_id === ESTACION_HUDSON &&
        r.sentido === 'IDA' &&
        r.categoria === 1 &&
        r.status === 'NO_PICO',
    );
    expect(hudsonIdaCat1?.importe).toBe(5500);
    expect(hudsonIdaCat1?.current_tarifa_importe_id).toBe(TI_100);
    expect(result.rows.filter((r) => r.current_tarifa_importe_id === TI_099).length).toBe(0);
  });

  it('no mezcla HUDSON IDA con VUELTA al cargar el editor', async () => {
    const editor = await firstValueFrom(mock.obtenerEditor(PEAJE_AUBASA, ESTACION_HUDSON, 'IDA'));
    expect(editor.context.sentido).toBe('IDA');
    expect(editor.context.estacion_nombre).toBe('HUDSON');
    const rows = buildRows(editor.existentes);
    const cat1 = rows.find((r) => r.categoria === 1)!;
    const cat2 = rows.find((r) => r.categoria === 2)!;
    expect(cat1.no_pico.importe).toBe(5500);
    expect(cat1.pico.importe).toBe(6000);
    expect(cat2.no_pico.importe).toBe(7000);
    expect(cat2.pico.importe).toBe(7500);
    expect(editor.existentes.every((e) => e.importe !== 5700 && e.importe !== 6200)).toBeTrue();
  });

  it('carga BERNAL AMBAS como contexto independiente', async () => {
    const editor = await firstValueFrom(mock.obtenerEditor(PEAJE_AUBASA, ESTACION_BERNAL, 'AMBAS'));
    expect(editor.context.sentido).toBe('AMBAS');
    const rows = buildRows(editor.existentes);
    expect(rows.find((r) => r.categoria === 1)?.no_pico.importe).toBe(5000);
    expect(rows.find((r) => r.categoria === 1)?.pico.importe).toBe(5500);
    const ida = await firstValueFrom(mock.obtenerEditor(PEAJE_AUBASA, ESTACION_BERNAL, 'IDA'));
    expect(ida.existentes.length).toBe(0);
  });

  it('expone celdas faltantes como null, no 0', async () => {
    const editor = await firstValueFrom(
      mock.obtenerEditor(PEAJE_AUBASA, ESTACION_INCOMPLETA, 'IDA'),
    );
    const rows = buildRows(editor.existentes);
    expect(rows.find((r) => r.categoria === 2)?.pico.importe).toBeNull();
    expect(rows.find((r) => r.categoria === 3)?.no_pico.importe).toBeNull();
    expect(rows.map((r) => r.categoria)).toEqual([1, 2, 3]);
    expect(rows.find((r) => r.categoria === 1)?.no_pico.importe).toBe(5500);
  });

  it('un contexto vacio es exito y no un error', async () => {
    const editor = await firstValueFrom(mock.obtenerEditor(PEAJE_AUBASA, ESTACION_VACIA, 'IDA'));
    expect(editor.existentes).toEqual([]);
    expect(editor.context.estacion_nombre).toBe('VACIA');
    expect(buildRows(editor.existentes).length).toBe(0);
  });

  it('al guardar appendea historial y cambia el puntero current', async () => {
    await firstValueFrom(
      mock.guardar(PEAJE_AUBASA, ESTACION_HUDSON, 'IDA', [
        { categoria: 1, status: 'NO_PICO', importe: 5800 },
      ]),
    );
    const hist = await firstValueFrom(
      mock.listarHistorial(
        (await firstValueFrom(mock.obtenerEditor(PEAJE_AUBASA, ESTACION_HUDSON, 'IDA'))).existentes.find(
          (e) => e.categoria === 1 && e.status === 'NO_PICO',
        )!.tarifa_id,
      ),
    );
    expect(hist.map((h) => h.importe)).toEqual([5800, 5500, 5000]);
    expect(hist.find((h) => h.id === TI_099)?.importe).toBe(5000);
    expect(hist.find((h) => h.id === TI_100)?.importe).toBe(5500);
    expect(hist.find((h) => h.es_actual)?.importe).toBe(5800);
    expect(hist.find((h) => h.es_actual)?.id).not.toBe(TI_100);
  });

  it('crea identidad e historial al guardar una celda faltante', async () => {
    await firstValueFrom(
      mock.guardar(PEAJE_AUBASA, ESTACION_INCOMPLETA, 'IDA', [
        { categoria: 2, status: 'PICO', importe: 7900 },
      ]),
    );
    const editor = await firstValueFrom(
      mock.obtenerEditor(PEAJE_AUBASA, ESTACION_INCOMPLETA, 'IDA'),
    );
    const cell = editor.existentes.find((e) => e.categoria === 2 && e.status === 'PICO');
    expect(cell?.importe).toBe(7900);
    expect(cell?.tarifa_id).toBeTruthy();
    const hist = await firstValueFrom(mock.listarHistorial(cell!.tarifa_id));
    expect(hist.length).toBe(1);
    expect(hist[0].es_actual).toBeTrue();
  });
});
