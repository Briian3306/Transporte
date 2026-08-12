import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TarifaFamiliaPanelComponent } from './tarifa-familia-panel.component';
import { buildZarate, MOCK_STATUS_CATALOG, PEAJE_CV } from './mocks/auditoria-tarifas.mock';

describe('TarifaFamiliaPanelComponent', () => {
  let fixture: ComponentFixture<TarifaFamiliaPanelComponent>;
  let component: TarifaFamiliaPanelComponent;
  const catalog = MOCK_STATUS_CATALOG.filter((c) => c.peaje_id === PEAJE_CV);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TarifaFamiliaPanelComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TarifaFamiliaPanelComponent);
    component = fixture.componentInstance;
    component.niveles = buildZarate();
    component.catalogo = catalog;
    fixture.detectChanges();
  });

  it('sugiere por precio ascendente usando orden del catálogo', () => {
    const ordered = [...component.niveles].sort((a, b) => a.importe - b.importe);
    const expected = ['NO_PICO', 'PICO', 'PICO', 'PICO', 'PICO'];
    const actual = ordered.map((n) => component.selections.get(n.id));
    expect(actual).toEqual(expected);
  });

  it('arma p_asignaciones con status_codigo', () => {
    const asignaciones = component.buildAsignaciones();
    expect(asignaciones.length).toBe(5);
    expect(asignaciones[0].status_codigo).toBeDefined();
    expect(asignaciones.every((a) => 'tarifa_normalizada_id' in a)).toBeTrue();
  });
});
