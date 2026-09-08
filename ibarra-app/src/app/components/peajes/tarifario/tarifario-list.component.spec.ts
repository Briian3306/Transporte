import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PEAJES_CATALOGO_SERVICE } from '../models';
import { PEAJES_TARIFARIO_SERVICE, PeajesTarifarioService } from '../models/tarifario.contracts';
import { TarifarioMockService, ESTACION_HUDSON, PEAJE_AUBASA } from './mocks/tarifario.mock';
import { TarifarioListComponent } from './tarifario-list.component';
import { MISSING_IMPORTE_LABEL } from './tarifario.helpers';

describe('TarifarioListComponent', () => {
  let fixture: ComponentFixture<TarifarioListComponent>;
  let component: TarifarioListComponent;
  let tarifario: PeajesTarifarioService;
  let listarSpy: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TarifarioListComponent],
      providers: [
        provideRouter([]),
        { provide: PEAJES_TARIFARIO_SERVICE, useClass: TarifarioMockService },
        {
          provide: PEAJES_CATALOGO_SERVICE,
          useValue: {
            listarPeajes: () => of([{ id: PEAJE_AUBASA, nombre: 'AUBASA' }]),
            listarEstaciones: () =>
              of([
                { id: ESTACION_HUDSON, peaje_id: PEAJE_AUBASA, nombre: 'HUDSON' },
              ]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TarifarioListComponent);
    component = fixture.componentInstance;
    tarifario = TestBed.inject(PEAJES_TARIFARIO_SERVICE);
    listarSpy = spyOn(tarifario, 'listar').and.callThrough();
    fixture.detectChanges();
    await fixture.whenStable();
    listarSpy.calls.reset();
  });

  it('aplica debounce de 300 ms a los cambios de filtro', fakeAsync(() => {
    const loadRowsSpy = spyOn(component, 'loadRows').and.returnValue(Promise.resolve());
    component.patchFilters({ q_estacion: 'a' });
    component.patchFilters({ q_estacion: 'ab' });
    component.patchFilters({ q_estacion: 'HUD' });
    tick(299);
    expect(loadRowsSpy).not.toHaveBeenCalled();
    tick(1);
    expect(loadRowsSpy).toHaveBeenCalledTimes(1);
  }));

  it('resetea la pagina al filtrar', fakeAsync(() => {
    component.page = 3;
    component.patchFilters({ q_estacion: 'HUDSON' });
    tick(300);
    expect(component.page).toBe(1);
  }));

  it('filtra por sentido exacto y no mezcla IDA con VUELTA', fakeAsync(async () => {
    component.onSentido('IDA');
    tick(300);
    await fixture.whenStable();
    const args = listarSpy.calls.mostRecent().args[0];
    expect(args.filters.sentidos).toEqual(['IDA']);
  }));

  it('el enlace Editar conserva peaje, estacion y sentido', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const row = component.rows.find((r) => r.estacion_id === ESTACION_HUDSON && r.sentido === 'VUELTA');
    expect(row).toBeTruthy();
    expect(component.editorHref(row!)).toEqual([
      '/peajes/tarifario',
      PEAJE_AUBASA,
      ESTACION_HUDSON,
      'VUELTA',
    ]);
  });

  it('muestra em dash cuando el importe actual falta', () => {
    expect(component.formatImporte({
      tarifa_id: 'x',
      peaje_id: PEAJE_AUBASA,
      peaje_nombre: 'AUBASA',
      estacion_id: ESTACION_HUDSON,
      estacion_nombre: 'HUDSON',
      categoria: 4,
      status: 'PICO',
      sentido: 'IDA',
      importe: null,
      fecha_actualizacion: null,
      current_tarifa_importe_id: null,
    })).toBe(MISSING_IMPORTE_LABEL);
  });
});
