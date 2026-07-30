import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CatalogoPeajesComponent } from './catalogo-peajes.component';
import { provideRouter } from '@angular/router';
import { PEAJES_CATALOGOS_MOCK_PROVIDERS } from '../catalogos.providers';

describe('CatalogoPeajesComponent', () => {
  let fixture: ComponentFixture<CatalogoPeajesComponent>;
  let component: CatalogoPeajesComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogoPeajesComponent],
      providers: [provideRouter([]), ...PEAJES_CATALOGOS_MOCK_PROVIDERS],
    }).compileComponents();

    fixture = TestBed.createComponent(CatalogoPeajesComponent);
    component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();
  });

  it('lista peajes y permite crear vía servicio (mock hasta F01-1)', async () => {
    const before = component.peajes.length;
    component.form.setValue({
      nombre: 'Peaje Test',
      ubicacion: 'Test',
      descripcion: '',
      empresa_id: 'EMP-001',
    });
    await component.guardar();
    expect(component.peajes.length).toBe(before + 1);
    expect(component.peajes.some((p) => p.nombre === 'Peaje Test')).toBeTrue();
  });
});
