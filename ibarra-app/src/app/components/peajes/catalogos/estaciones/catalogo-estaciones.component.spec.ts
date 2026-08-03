import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CatalogoEstacionesComponent } from './catalogo-estaciones.component';
import { provideRouter } from '@angular/router';
import { PEAJES_CATALOGOS_MOCK_PROVIDERS } from '../catalogos.providers';

describe('CatalogoEstacionesComponent', () => {
  let fixture: ComponentFixture<CatalogoEstacionesComponent>;
  let component: CatalogoEstacionesComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogoEstacionesComponent],
      providers: [provideRouter([]), ...PEAJES_CATALOGOS_MOCK_PROVIDERS],
    }).compileComponents();

    fixture = TestBed.createComponent(CatalogoEstacionesComponent);
    component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();
  });

  it('sugiere estación por código proveedor y permite crear', async () => {
    component.busqueda = '3';
    await component.sugerir();
    expect(component.sugeridas.length).toBeGreaterThan(0);
    expect(component.sugeridas[0].nombre).toContain('Monte');

    const peajeId = component.peajes[0]?.id;
    expect(peajeId).toBeTruthy();
    component.form.setValue({
      peaje_id: peajeId!,
      nombre: 'Estación Nueva',
      ubicacion: '',
      descripcion: '',
      codigos_proveedor: '42',
      latitud: null,
      longitud: null,
      camino: '',
    });
    const before = component.estaciones.length;
    await component.guardar();
    expect(component.estaciones.length).toBe(before + 1);
  });
});
