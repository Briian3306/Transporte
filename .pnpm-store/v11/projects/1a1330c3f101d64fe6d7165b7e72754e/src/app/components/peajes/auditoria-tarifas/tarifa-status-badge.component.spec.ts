import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TarifaStatusBadgeComponent } from './tarifa-status-badge.component';
import { MOCK_STATUS_CATALOG, PEAJE_CV } from './mocks/auditoria-tarifas.mock';

describe('TarifaStatusBadgeComponent', () => {
  let fixture: ComponentFixture<TarifaStatusBadgeComponent>;
  let component: TarifaStatusBadgeComponent;
  const catalog = MOCK_STATUS_CATALOG.filter((c) => c.peaje_id === PEAJE_CV);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TarifaStatusBadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TarifaStatusBadgeComponent);
    component = fixture.componentInstance;
  });

  it('resuelve etiqueta y color desde el catálogo', () => {
    component.codigo = 'PICO';
    component.catalogo = catalog;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pico');
  });

  it('muestra el código crudo en gris si es desconocido', () => {
    component.codigo = 'PICO_MANANA';
    component.catalogo = catalog;
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('PICO_MANANA');
    expect(el.querySelector('.at__code')).toBeTruthy();
  });

  it('no rompe con el catálogo vacío', () => {
    component.codigo = 'PICO';
    component.catalogo = [];
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('PICO');
    expect(fixture.nativeElement.querySelector('.at__badge')?.getAttribute('aria-busy')).toBe('true');
  });

  it('trata PENDIENTE y null como Sin clasificar', () => {
    component.codigo = null;
    component.catalogo = catalog;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sin clasificar');
    component.codigo = 'PENDIENTE';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sin clasificar');
  });
});
