import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TarifaStatusButtonsComponent } from './tarifa-status-buttons.component';
import { MOCK_STATUS_CATALOG, PEAJE_CV } from './mocks/auditoria-tarifas.mock';

describe('TarifaStatusButtonsComponent', () => {
  let fixture: ComponentFixture<TarifaStatusButtonsComponent>;
  let component: TarifaStatusButtonsComponent;
  const catalog = MOCK_STATUS_CATALOG.filter((c) => c.peaje_id === PEAJE_CV);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TarifaStatusButtonsComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TarifaStatusButtonsComponent);
    component = fixture.componentInstance;
    component.catalogo = catalog;
    component.importe = 1500;
    fixture.detectChanges();
  });

  it('renderiza botones del catálogo ordenados por orden', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.at__status-btn');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    expect(buttons[0].textContent).toContain('No pico');
  });

  it('no renderiza PENDIENTE como botón', () => {
    component.selected = 'PENDIENTE';
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.at__status-btn');
    for (const btn of buttons) {
      expect(btn.textContent).not.toContain('Pendiente');
    }
    expect(fixture.nativeElement.textContent).toContain('Sin clasificar');
  });

  it('expone role=radiogroup y aria-checked', () => {
    component.selected = 'PICO';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="radiogroup"]')).toBeTruthy();
    const checked = fixture.nativeElement.querySelectorAll('[aria-checked="true"]');
    expect(checked.length).toBe(1);
  });
});
