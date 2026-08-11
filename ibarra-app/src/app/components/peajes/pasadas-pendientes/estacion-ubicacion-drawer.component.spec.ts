import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EstacionUbicacionDrawerComponent } from './estacion-ubicacion-drawer.component';
import { EstacionPendienteGrupo } from '../models';

describe('EstacionUbicacionDrawerComponent', () => {
  let fixture: ComponentFixture<EstacionUbicacionDrawerComponent>;
  let component: EstacionUbicacionDrawerComponent;

  const group: EstacionPendienteGrupo = {
    id: 'est-1',
    estacion_id: 'est-1',
    estacion_nombre: 'Alberti',
    peaje_id: 'peaje-1',
    empresa_nombre: 'AUSA',
    fecha_desde: '2026-07-01T10:00:00Z',
    fecha_hasta: '2026-07-02T12:00:00Z',
    cantidad_pasadas: 3,
    total_importe: 1500,
    estacion_latitud: null,
    estacion_longitud: null,
    camino: null,
    ubicacion: null,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstacionUbicacionDrawerComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(EstacionUbicacionDrawerComponent);
    component = fixture.componentInstance;
    component.open = true;
    component.group = group;
    fixture.detectChanges();
  });

  it('muestra badge PENDING sin coordenadas', () => {
    expect(component.badge).toBe('PENDING');
  });

  it('emite payload al guardar lat/lng', () => {
    const spy = jasmine.createSpy('save');
    component.save.subscribe(spy);
    component.form.setValue({
      latitud: -34.6,
      longitud: -58.4,
      camino: 'Colectora',
      ubicacion: 'Km 1',
    });
    component.submit();
    expect(spy).toHaveBeenCalledWith({
      latitud: -34.6,
      longitud: -58.4,
      camino: 'Colectora',
      ubicacion: 'Km 1',
    });
    expect(component.badge).toBe('OK');
  });
});
