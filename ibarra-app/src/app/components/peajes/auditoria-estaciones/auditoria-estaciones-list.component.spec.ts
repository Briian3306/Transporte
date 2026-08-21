import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditoriaEstacionesListComponent } from './auditoria-estaciones-list.component';
import { PEAJES_AUDITORIA_ESTACIONES_SERVICE } from '../models/auditoria-estaciones.contracts';
import { PEAJES_CATALOGO_SERVICE, PEAJES_PASADAS_SERVICE } from '../models';
import { AuditoriaEstacionesMockService, FIXTURE_AISLADO, FIXTURE_SECUENCIA } from './mocks/auditoria-estaciones.mock';

describe('AuditoriaEstacionesListComponent', () => {
  let fixture: ComponentFixture<AuditoriaEstacionesListComponent>;
  let component: AuditoriaEstacionesListComponent;
  let pasadasListar: jasmine.Spy;

  beforeEach(async () => {
    pasadasListar = jasmine.createSpy('listar').and.returnValue(of({ rows: [], total: 0, limit: 50, offset: 0 }));
    await TestBed.configureTestingModule({
      imports: [AuditoriaEstacionesListComponent],
      providers: [
        provideRouter([]),
        { provide: PEAJES_AUDITORIA_ESTACIONES_SERVICE, useClass: AuditoriaEstacionesMockService },
        {
          provide: PEAJES_CATALOGO_SERVICE,
          useValue: {
            listarPeajes: () => of([]),
            listarEmpresas: () => of([]),
            listarEstaciones: () => of([]),
          },
        },
        { provide: PEAJES_PASADAS_SERVICE, useValue: { listar: pasadasListar } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuditoriaEstacionesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('muestra salto 4 en 1,2,3,5 y no alarma en 3,5 aislado', () => {
    const seq = component.rows.find((r) => r.estacionId === FIXTURE_SECUENCIA.estacionId);
    const iso = component.rows.find((r) => r.estacionId === FIXTURE_AISLADO.estacionId);
    expect(seq?.secuenciaEsperada?.faltantes).toEqual([4]);
    expect(component.muestraAlarma(seq!)).toBeTrue();
    expect(iso?.hallazgos.length).toBe(0);
    expect(component.muestraAlarma(iso!)).toBeFalse();
  });

  it('expande la fila padre con un unico expandedId', () => {
    const row = component.rows[0];
    component.toggleExpand(row);
    expect(component.expandedId).toBe(row.estacionId);
    component.toggleExpand(row);
    expect(component.expandedId).toBeNull();
  });

  it('muestra el error con role=alert', fakeAsync(async () => {
    const svc = TestBed.inject(PEAJES_AUDITORIA_ESTACIONES_SERVICE);
    spyOn(svc, 'listar').and.returnValue(throwError(() => new Error('fail')));
    component.onQ('x');
    tick(300);
    await fixture.whenStable();
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No se pudieron cargar las estaciones');
  }));

  it('un caso validado no queda en Pendientes al recargar', fakeAsync(async () => {
    const row = component.rows.find((r) => r.estacionId === FIXTURE_SECUENCIA.estacionId)!;
    await component.onConfirm(row, { estado: 'VALIDADO', observacion: 'ok' });
    component.estados = ['PENDIENTE'];
    await component.loadRows();
    expect(component.rows.some((r) => r.estacionId === row.estacionId)).toBeFalse();
  }));

  it('Ver casos pide pasadas por estacion_id', async () => {
    await component.openVerCasos(FIXTURE_SECUENCIA);
    expect(pasadasListar).toHaveBeenCalled();
    const args = pasadasListar.calls.mostRecent().args[0];
    expect(args.filters.estacion_ids).toEqual([FIXTURE_SECUENCIA.estacionId]);
  });

  it('la corrección exige preview', async () => {
    const svc = TestBed.inject(PEAJES_AUDITORIA_ESTACIONES_SERVICE);
    await expectAsync(
      lastValueFrom(
        svc.corregir({
          casoId: 'x',
          estacionDestinoId: 'y',
          modalidad: 'SOLO_FUTUROS',
          previewHash: '',
        }),
      ),
    ).toBeRejected();
  });
});
