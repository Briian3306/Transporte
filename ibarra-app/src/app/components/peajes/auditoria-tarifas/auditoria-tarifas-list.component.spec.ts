import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Injector } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuditoriaTarifasListComponent } from './auditoria-tarifas-list.component';
import {
  PEAJES_AUDITORIA_TARIFAS_SERVICE,
  PeajesAuditoriaTarifasService,
} from './contracts.local';
import { PEAJES_CATALOGO_SERVICE, PEAJES_PASADAS_SERVICE } from '../models';
import { AuditoriaTarifasMockService } from './mocks/auditoria-tarifas.mock';

describe('AuditoriaTarifasListComponent', () => {
  let fixture: ComponentFixture<AuditoriaTarifasListComponent>;
  let component: AuditoriaTarifasListComponent;
  let auditoria: PeajesAuditoriaTarifasService;
  let listarSpy: jasmine.Spy;
  let pasadasListar: jasmine.Spy;

  beforeEach(async () => {
    pasadasListar = jasmine.createSpy('listar').and.returnValue(
      of({ rows: [], total: 0, limit: 50, offset: 0 })
    );
    await TestBed.configureTestingModule({
      imports: [AuditoriaTarifasListComponent],
      providers: [
        provideRouter([]),
        { provide: PEAJES_AUDITORIA_TARIFAS_SERVICE, useClass: AuditoriaTarifasMockService },
        {
          provide: PEAJES_CATALOGO_SERVICE,
          useValue: {
            listarPeajes: () => of([{ id: 'peaje-corredores-viales', nombre: 'CORREDORES VIALES SA', empresa_id: 'e1' }]),
            listarEmpresas: () =>
              of([
                {
                  id: 'e1',
                  nombre: 'AUSA',
                  tarifa_url: 'https://www.ausa.com.ar/sections/tarifas.html',
                },
              ]),
            actualizarEmpresa: (id: string, data: { tarifa_url?: string | null }) =>
              of({ id, nombre: 'AUSA', ...data }),
            listarEstaciones: () => of([]),
          },
        },
        {
          provide: PEAJES_PASADAS_SERVICE,
          useValue: { listar: pasadasListar },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuditoriaTarifasListComponent);
    component = fixture.componentInstance;
    auditoria = TestBed.inject(Injector).get(PEAJES_AUDITORIA_TARIFAS_SERVICE) as PeajesAuditoriaTarifasService;
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

  it('resetea la pagina al filtrar', fakeAsync(() => {
    component.page = 3;
    component.patchFilters({ q_estacion: 'ZARATE' });
    tick(300);
    expect(component.page).toBe(1);
  }));

  it('ordena por cases desc al iniciar', () => {
    expect(component.sortKey).toBe('cases');
    expect(component.sortDirection).toBe('desc');
  });

  it('deshabilita Recalcular sin un peaje unico', () => {
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

  it('expande la familia inline como la tabla de referencia', () => {
    const row = component.rows[0];
    component.toggleExpand(row);
    expect(component.expandedId).toBe(row.id);
    component.toggleExpand(row);
    expect(component.expandedId).toBeNull();
  });

  it('no expone CONFIRMADO como opcion de clasificacion', () => {
    component.catalogByPeaje.set('p1', [
      { peaje_id: 'p1', codigo: 'PICO', etiqueta: 'Pico', color: '#f59e0b', tipo_meta: 'PICO', orden: 1 },
      { peaje_id: 'p1', codigo: 'NO_PICO', etiqueta: 'No pico', color: '#10b981', tipo_meta: 'NO_PICO', orden: 2 },
      { peaje_id: 'p1', codigo: 'CONFIRMADO', etiqueta: 'Confirmado', color: '#0f766e', tipo_meta: 'NEUTRO', orden: 3 },
    ]);
    expect(component.statusOptions.map((option) => option.id)).not.toContain('CONFIRMADO');
  });

  it('expone chips de status visibles y los combina', () => {
    component.toggleStatusQuick('PICO');
    component.toggleStatusQuick('NO_PICO');
    expect(component.filters.status).toEqual(['PICO', 'NO_PICO']);
    component.toggleStatusQuick('PICO');
    expect(component.filters.status).toEqual(['NO_PICO']);
  });

  it('calcula el resumen global y ordena concesiones pendientes primero', () => {
    component.progress = [
      { peaje_id: 'done', peaje_nombre: 'Completa', total: 10, pendientes: 0 },
      { peaje_id: 'pending', peaje_nombre: 'Pendiente', total: 10, pendientes: 7 },
    ];
    expect(component.progressSummary).toEqual({ total: 20, classified: 13, pending: 7, pct: 65 });
    component.progress.sort((a, b) => b.pendientes - a.pendientes);
    expect(component.progress[0].peaje_id).toBe('pending');
  });

  it('abre Ver casos filtrando pasadas por tarifa_normalizada_id', fakeAsync(async () => {
    const row = component.rows[0];
    component.openVerCasos(row);
    tick();
    await fixture.whenStable();
    expect(component.casosOpen).toBeTrue();
    expect(pasadasListar).toHaveBeenCalled();
    const args = pasadasListar.calls.mostRecent().args[0];
    expect(args.filters.tarifa_normalizada_id).toBe(row.id);
    expect(args.sort).toBe('fecha_hora');
    expect(args.dir).toBe('desc');
  }));

  it('resuelve tarifa_url desde la empresa del peaje', () => {
    const row = component.rows[0];
    expect(component.tarifaUrlForRow(row)).toBe('https://www.ausa.com.ar/sections/tarifas.html');
  });

  it('abre el dialogo de URL de tarifas y guarda en la empresa', fakeAsync(async () => {
    const row = component.rows[0];
    component.openTarifaUrlDialog(row);
    expect(component.tarifaUrlDialogOpen).toBeTrue();
    expect(component.tarifaUrlEmpresa?.id).toBe('e1');
    component.tarifaUrlDraft = 'https://www.ausa.com.ar/sections/tarifas.html';
    await component.saveTarifaUrl();
    tick();
    await fixture.whenStable();
    expect(component.tarifaUrlDialogOpen).toBeFalse();
    expect(component.empresas[0].tarifa_url).toBe('https://www.ausa.com.ar/sections/tarifas.html');
  }));

  it('rechaza una URL sin http(s)', async () => {
    component.openTarifaUrlDialog(component.rows[0]);
    component.tarifaUrlDraft = 'ftp://example.com';
    await component.saveTarifaUrl();
    expect(component.tarifaUrlDialogOpen).toBeTrue();
    expect(component.tarifaUrlError).toContain('http://');
  });

  it('envía status y CAT al confirmar y no remonta el panel de familia', fakeAsync(async () => {
    const confirmSpy = spyOn(auditoria, 'confirmarStatus').and.callThrough();
    const row = component.rows[0];
    component.toggleExpand(row);
    tick(80);
    await fixture.whenStable();
    expect(component.familiaNiveles.length).toBeGreaterThan(0);

    const asignaciones = component.familiaNiveles.map((n) => ({
      tarifa_normalizada_id: n.id,
      status_codigo: 'NO_PICO',
      categoria_calculated: 5,
    }));
    const pending = component.onConfirmFamilia(asignaciones);
    expect(component.familiaLoading).toBeFalse();
    tick(200);
    await pending;
    await fixture.whenStable();

    expect(confirmSpy).toHaveBeenCalled();
    const payload = confirmSpy.calls.mostRecent().args[0] as Array<{
      status_codigo: string;
      categoria_calculated?: number;
    }>;
    expect(payload.every((a) => a.status_codigo === 'NO_PICO' && a.categoria_calculated === 5)).toBeTrue();
    expect(component.familiaLoading).toBeFalse();
    expect(component.familiaNiveles.length).toBeGreaterThan(0);
  }));
});
