import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TarifaStatusButtonsComponent } from './tarifa-status-buttons.component';
import { MOCK_STATUS_CATALOG, PEAJE_CV } from './mocks/auditoria-tarifas.mock';

describe('TarifaStatusButtonsComponent', () => {
  let fixture: ComponentFixture<TarifaStatusButtonsComponent>;
  let component: TarifaStatusButtonsComponent;
  const catalog = MOCK_STATUS_CATALOG.filter((status) => status.peaje_id === PEAJE_CV);

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

  it('expone opciones del catálogo en un search-select filtrable', () => {
    expect(fixture.nativeElement.querySelector('app-search-select')).toBeTruthy();
    expect(component.options.map((o) => o.id)).toEqual(['NO_PICO', 'PICO', 'POSIBLE_HORARIO']);
    expect(fixture.nativeElement.querySelector('[role="radiogroup"]')).toBeFalsy();
  });

  it('mapea PENDIENTE a valor vacío (Sin clasificar) en el select', () => {
    component.selected = 'PENDIENTE';
    fixture.detectChanges();
    expect(component.selectValue).toBeNull();
    expect(component.currentLabel).toBe('Sin clasificar');
  });

  it('emite el código elegido y limpia a PENDIENTE', () => {
    const emitted: string[] = [];
    component.selectedChange.subscribe((v) => emitted.push(v));

    component.onValueChange('PICO');
    expect(emitted).toEqual(['PICO']);
    expect(component.selected).toBe('PICO');

    component.onValueChange(null);
    expect(emitted).toEqual(['PICO', 'PENDIENTE']);
    expect(component.selected).toBe('PENDIENTE');
  });

  it('incluye POSIBLE_HORARIO como opción seleccionable', () => {
    expect(component.options.some((o) => o.id === 'POSIBLE_HORARIO')).toBeTrue();
    expect(component.options.find((o) => o.id === 'POSIBLE_HORARIO')?.label).toBe('Posible horario');
  });

  it('no ofrece PENDIENTE ni CONFIRMADO en la lista', () => {
    expect(component.options.some((o) => o.id === 'PENDIENTE')).toBeFalse();
    expect(component.options.some((o) => o.id === 'CONFIRMADO')).toBeFalse();
  });
});
