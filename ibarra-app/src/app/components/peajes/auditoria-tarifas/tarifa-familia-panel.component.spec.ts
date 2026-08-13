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

  it('formatea la franja como HH:mm – HH:mm (primer–último caso)', () => {
    expect(component.formatHour(3)).toBe('03:00');
    expect(component.formatHour(5.5)).toBe('05:30');
    expect(component.formatHour(18.5)).toBe('18:30');
    const row = { ...component.niveles[0], hora_min: 3, hora_max: 5, hora_media: 4 };
    expect(component.franjaLabel(row)).toBe('03:00 – 05:00');
    expect(component.mediaLabel(row)).toContain('Media');
    expect(component.mediaLabel(row)).toContain('h');
  });

  it('muestra franja con solo min/max y fallback cuando faltan horas', () => {
    const withMinMax = { ...component.niveles[0], hora_min: 7, hora_max: 10, hora_media: null, desvio: null };
    expect(component.hasHours(withMinMax)).toBeTrue();
    expect(component.franjaLabel(withMinMax)).toBe('07:00 – 10:00');

    const empty = { ...component.niveles[0], hora_min: null, hora_media: null, hora_max: null };
    expect(component.hasHours(empty)).toBeFalse();
    expect(component.franjaLabel(empty)).toBe('Sin datos horarios');
    expect(component.mediaLabel(empty)).toBe('Sin datos horarios');
  });

  it('pagina niveles sin perder la selección del nivel', () => {
    component.niveles = Array.from({ length: 12 }, (_, index) => ({
      ...component.niveles[0],
      id: `nivel-${index}`,
      importe: index + 1,
    }));
    component.ngOnChanges({ niveles: {} as never });
    component.onSelect('nivel-0', 'PICO');
    component.onDetailPageSize(10);
    component.goDetailPage(2);
    expect(component.detailRangeLabel).toBe('11–12 de 12');
    expect(component.selections.get('nivel-0')).toBe('PICO');
  });

  it('usa Sin cambios cuando no hay asignaciones disponibles', () => {
    component.niveles = [{ ...component.niveles[0], diagnostico: 'MUESTRA_INSUFICIENTE', status: 'PENDIENTE' }];
    component.ngOnChanges({ niveles: {} as never });
    expect(component.buildAsignaciones()).toEqual([]);
    expect(component.confirmLabel).toBe('Sin cambios');
  });

  it('renderiza el search-select de clasificación y la franja HH:mm – HH:mm', () => {
    const selects = fixture.nativeElement.querySelectorAll('app-search-select');
    expect(selects.length).toBeGreaterThan(0);
    const franjas: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.at__franja-range');
    expect(franjas.length).toBeGreaterThan(0);
    expect(franjas[0].textContent?.trim()).toMatch(/\d{2}:\d{2}\s–\s\d{2}:\d{2}/);
  });

  it('permite cambiar la clasificación de NO_PICO a PICO', () => {
    const cheapest = [...component.niveles].sort((a, b) => a.importe - b.importe)[0];
    expect(component.selections.get(cheapest.id)).toBe('NO_PICO');
    component.onSelect(cheapest.id, 'PICO');
    expect(component.selections.get(cheapest.id)).toBe('PICO');
    expect(component.suggestionPristine).toBeFalse();
  });

  it('emite verCasos al pulsar Ver casos', () => {
    const emitted: string[] = [];
    component.verCasos.subscribe((row) => emitted.push(row.id));
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Ver casos"]');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Ver casos');
    btn.click();
    expect(emitted.length).toBe(1);
    expect(component.niveles.some((n) => n.id === emitted[0])).toBeTrue();
  });
});
