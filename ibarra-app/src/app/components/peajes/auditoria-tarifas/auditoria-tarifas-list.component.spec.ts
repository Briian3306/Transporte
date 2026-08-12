import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Injector } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuditoriaTarifasListComponent } from './auditoria-tarifas-list.component';
import {
  PEAJES_AUDITORIA_TARIFAS_SERVICE,
  PeajesAuditoriaTarifasService,
} from './contracts.local';
import { PEAJES_CATALOGO_SERVICE } from '../models';
import { AuditoriaTarifasMockService } from './mocks/auditoria-tarifas.mock';

describe('AuditoriaTarifasListComponent', () => {
  let fixture: ComponentFixture<AuditoriaTarifasListComponent>;
  let component: AuditoriaTarifasListComponent;
  let auditoria: PeajesAuditoriaTarifasService;
  let listarSpy: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditoriaTarifasListComponent],
      providers: [
        provideRouter([]),
        { provide: PEAJES_AUDITORIA_TARIFAS_SERVICE, useClass: AuditoriaTarifasMockService },
        {
          provide: PEAJES_CATALOGO_SERVICE,
          useValue: {
            listarPeajes: () => of([{ id: 'p1', nombre: 'Peaje 1', empresa_id: 'e1' }]),
            listarEstaciones: () => of([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuditoriaTarifasListComponent);
    component = fixture.componentInstance;
    auditoria = TestBed.inject(Injector).get(
      PEAJES_AUDITORIA_TARIFAS_SERVICE
    ) as PeajesAuditoriaTarifasService;
    listarSpy = spyOn(auditoria, 'listar').and.callThrough();
    fixture.detectChanges();
    await fixture.whenStable();
    listarSpy.calls.reset();
  });

  it('aplica debounce de 300 ms a los cambios de filtro', fakeAsync(async () => {
    await fixture.whenStable();
    const loadRowsSpy = spyOn(component, 'loadRows').and.returnValue(Promise.resolve());
    component.patchFilters({ q_estacion: 'a' });
    component.patchFilters({ q_estacion: 'ab' });
    component.patchFilters({ q_estacion: 'abc' });
    tick(299);
    expect(loadRowsSpy).not.toHaveBeenCalled();
    tick(1);
    expect(loadRowsSpy).toHaveBeenCalledTimes(1);
  }));

  it('resetea la página al filtrar', fakeAsync(() => {
    component.page = 3;
    component.patchFilters({ q_estacion: 'ZARATE' });
    tick(300);
    expect(component.page).toBe(1);
  }));

  it('ordena por cases desc al iniciar', () => {
    expect(component.sortKey).toBe('cases');
    expect(component.sortDirection).toBe('desc');
  });

  it('deshabilita Recalcular sin un peaje único', () => {
    component.filters = {};
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.at__header-actions .at__btn');
    expect(btn.disabled).toBeTrue();
    component.filters = { peaje_ids: ['p1', 'p2'] };
    fixture.detectChanges();
    expect(btn.disabled).toBeTrue();
    component.filters = { peaje_ids: ['p1'] };
    fixture.detectChanges();
    expect(btn.disabled).toBeFalse();
  });

  it('muestra el mensaje de error con role=alert', fakeAsync(async () => {
    listarSpy.and.returnValue(throwError(() => new Error('fail')));
    component.patchFilters({ q_estacion: 'x' });
    tick(300);
    await fixture.whenStable();
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No se pudieron cargar las familias de tarifa');
  }));
});
