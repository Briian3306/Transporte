import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { PEAJES_TARIFARIO_SERVICE } from '../models/tarifario.contracts';
import {
  TARIFARIO_CATEGORIAS_MAX,
  MISSING_IMPORTE_LABEL,
} from './tarifario.helpers';
import {
  ESTACION_HUDSON,
  ESTACION_VACIA,
  PEAJE_AUBASA,
  TarifarioMockService,
} from './mocks/tarifario.mock';
import { TarifarioEditorComponent } from './tarifario-editor.component';

describe('TarifarioEditorComponent', () => {
  async function setup(sentido: string, estacionId = ESTACION_HUDSON) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TarifarioEditorComponent],
      providers: [
        provideRouter([]),
        { provide: PEAJES_TARIFARIO_SERVICE, useClass: TarifarioMockService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                peajeId: PEAJE_AUBASA,
                estacionId,
                sentido,
              }),
            },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TarifarioEditorComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, component };
  }

  it('no mezcla HUDSON IDA con precios de VUELTA', async () => {
    const { component } = await setup('IDA');
    const cat1 = component.rows.find((r) => r.categoria === 1)!;
    expect(cat1.no_pico.importe).toBe(5500);
    expect(cat1.pico.importe).toBe(6000);
    expect(component.rows.some((r) => r.no_pico.importe === 5700)).toBeFalse();
    expect(component.rows.map((r) => r.categoria)).toEqual([1, 2]);
  });

  it('no muestra filas vacias en un contexto sin tarifas', async () => {
    const { component } = await setup('IDA', ESTACION_VACIA);
    expect(component.rows.length).toBe(0);
  });

  it('muestra em dash en celdas sin precio actual', async () => {
    const { fixture, component } = await setup('IDA', ESTACION_VACIA);
    expect(component.displayActual(null)).toBe(MISSING_IMPORTE_LABEL);
    const text = fixture.nativeElement as HTMLElement;
    expect(text.textContent).toContain(MISSING_IMPORTE_LABEL);
  });

  it('omite New vacios al armar el payload de guardado', async () => {
    const { component } = await setup('IDA');
    const mock = TestBed.inject(PEAJES_TARIFARIO_SERVICE) as TarifarioMockService;
    const spy = spyOn(mock, 'guardar').and.callThrough();
    component.setDraft(1, 'NO_PICO', '5800');
    component.setDraft(1, 'PICO', '');
    component.setDraft(2, 'NO_PICO', '7300');
    component.setDraft(2, 'PICO', '7900');
    await component.save();
    expect(spy).toHaveBeenCalledWith(PEAJE_AUBASA, ESTACION_HUDSON, 'IDA', [
      { categoria: 1, status: 'NO_PICO', importe: 5800 },
      { categoria: 2, status: 'NO_PICO', importe: 7300 },
      { categoria: 2, status: 'PICO', importe: 7900 },
    ]);
  });

  it('no guarda si hay un New invalido', async () => {
    const { component } = await setup('IDA');
    const mock = TestBed.inject(PEAJES_TARIFARIO_SERVICE) as TarifarioMockService;
    const spy = spyOn(mock, 'guardar').and.callThrough();
    component.setDraft(1, 'NO_PICO', 'abc');
    await component.save();
    expect(spy).not.toHaveBeenCalled();
    expect(component.saveError).toContain('inválidos');
  });

  it('muestra la fecha de ultima actualizacion en el tablero', async () => {
    const { fixture, component } = await setup('IDA');
    const cat1 = component.rows.find((r) => r.categoria === 1)!;
    expect(cat1.no_pico.fecha_actualizacion).toBeTruthy();
    expect(component.ultimaActualizacion).not.toBe(MISSING_IMPORTE_LABEL);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      component.displayFecha(cat1.no_pico.fecha_actualizacion),
    );
  });

  it('tras guardar refresca la fecha de actualizacion vigente', async () => {
    const { component } = await setup('IDA');
    const before = component.rows.find((r) => r.categoria === 1)!.no_pico.fecha_actualizacion;
    component.setDraft(1, 'NO_PICO', '5800');
    await component.save();
    const after = component.rows.find((r) => r.categoria === 1)!.no_pico.fecha_actualizacion;
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
  });

  it('Tab en NUEVO va al siguiente NUEVO y omite Historial', async () => {
    const { fixture } = await setup('IDA');
    const root = fixture.nativeElement as HTMLElement;
    root.querySelectorAll('.tf__hist').forEach((btn) => {
      expect(btn.getAttribute('tabindex')).toBe('-1');
    });
    const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('.tf__input'));
    expect(inputs.length).toBeGreaterThan(1);
    inputs[0].focus();
    inputs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('Tab en el ultimo NUEVO va a Agregar categoria', async () => {
    const { fixture } = await setup('IDA');
    const root = fixture.nativeElement as HTMLElement;
    const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('.tf__input'));
    const add = root.querySelector<HTMLButtonElement>('.tf__add');
    expect(add).toBeTruthy();
    inputs[inputs.length - 1].focus();
    inputs[inputs.length - 1].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    expect(document.activeElement).toBe(add);
  });

  it('Agregar categoria suma una fila hasta el maximo de 10', async () => {
    const { fixture, component } = await setup('IDA', ESTACION_VACIA);
    expect(component.rows.length).toBe(0);
    component.addCategoria();
    fixture.detectChanges();
    expect(component.rows.map((r) => r.categoria)).toEqual([1]);
    while (component.canAddCategoria) {
      component.addCategoria();
    }
    fixture.detectChanges();
    expect(component.rows.length).toBe(TARIFARIO_CATEGORIAS_MAX);
    expect(component.canAddCategoria).toBeFalse();
    const add = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.tf__add');
    expect(add?.disabled).toBeTrue();
  });

  it('redirige a la lista si el sentido es invalido', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TarifarioEditorComponent],
      providers: [
        provideRouter([]),
        { provide: PEAJES_TARIFARIO_SERVICE, useClass: TarifarioMockService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                peajeId: PEAJE_AUBASA,
                estacionId: ESTACION_HUDSON,
                sentido: 'lado',
              }),
            },
          },
        },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    const nav = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    const fixture = TestBed.createComponent(TarifarioEditorComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(nav).toHaveBeenCalledWith(['/peajes/tarifario']);
  });
});
