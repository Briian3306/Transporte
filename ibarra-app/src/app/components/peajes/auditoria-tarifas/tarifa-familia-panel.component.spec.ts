import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TarifaFamiliaPanelComponent } from './tarifa-familia-panel.component';
import { buildZarate, MOCK_STATUS_CATALOG, PEAJE_CV } from './mocks/auditoria-tarifas.mock';
import { TarifaAsignacion } from './contracts.local';

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

  it('no muestra Reconocimiento detectado en familias de más de dos niveles', () => {
    expect(component.showReconocimiento).toBeFalse();
    expect(fixture.nativeElement.querySelector('.at__btn--reconocimiento')).toBeNull();
  });

  it('asigna No Pico al más bajo, Pico al más alto y confirma al pulsar Reconocimiento detectado', () => {
    const ordered = [...component.niveles].sort((a, b) => a.importe - b.importe);
    component.niveles = [
      { ...ordered[0], diagnostico: 'POSIBLE_HORARIO', status: 'PENDIENTE' },
      { ...ordered[1], diagnostico: 'POSIBLE_HORARIO', status: 'PENDIENTE' },
    ];
    component.ngOnChanges({ niveles: {} as never });
    fixture.detectChanges();

    expect(component.showReconocimiento).toBeTrue();
    expect(component.reconocimientoHint).toContain('No pico');
    expect(component.reconocimientoHint).toContain('Pico');
    expect(component.reconocimientoHint).toContain('Confirmado');

    const emitted: { tarifa_normalizada_id: string; status_codigo: string }[][] = [];
    component.confirm.subscribe((asignaciones) => emitted.push(asignaciones));
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.at__btn--reconocimiento');
    expect(btn.textContent).toContain('Reconocimiento detectado');
    btn.click();

    expect(emitted.length).toBe(1);
    expect(emitted[0]).toEqual([
      { tarifa_normalizada_id: component.niveles[0].id, status_codigo: 'NO_PICO' },
      { tarifa_normalizada_id: component.niveles[1].id, status_codigo: 'PICO' },
    ]);
    expect(component.selections.get(component.niveles[0].id)).toBe('NO_PICO');
    expect(component.selections.get(component.niveles[1].id)).toBe('PICO');
  });

  it('confirma automáticamente cuando el usuario elige No Pico y Pico en los dos precios', () => {
    const ordered = [...component.niveles].sort((a, b) => a.importe - b.importe);
    component.niveles = [ordered[0], ordered[1]];
    component.ngOnChanges({ niveles: {} as never });

    const emitted: { tarifa_normalizada_id: string; status_codigo: string }[][] = [];
    component.confirm.subscribe((asignaciones) => emitted.push(asignaciones));

    component.onSelect(ordered[0].id, 'NO_PICO');
    expect(emitted.length).toBe(0);

    component.onSelect(ordered[1].id, 'PICO');
    expect(emitted.length).toBe(1);
    expect(emitted[0].some((a) => a.tarifa_normalizada_id === ordered[0].id && a.status_codigo === 'NO_PICO')).toBeTrue();
    expect(emitted[0].some((a) => a.tarifa_normalizada_id === ordered[1].id && a.status_codigo === 'PICO')).toBeTrue();
  });

  it('no confirma si el usuario invierte Pico y No Pico', () => {
    const ordered = [...component.niveles].sort((a, b) => a.importe - b.importe);
    component.niveles = [ordered[0], ordered[1]];
    component.ngOnChanges({ niveles: {} as never });
    const emitted: unknown[] = [];
    component.confirm.subscribe((asignaciones) => emitted.push(asignaciones));
    component.onSelect(ordered[0].id, 'PICO');
    component.onSelect(ordered[1].id, 'NO_PICO');
    expect(emitted.length).toBe(0);
  });

  it('muestra el sello CAT en Patrón A y omite categoria_calculated si está vacío', () => {
    fixture.detectChanges();
    const stamps: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.at__clase-stamp');
    expect(stamps.length).toBe(component.niveles.length);
    expect(stamps[0].querySelector('.at__clase-kicker')?.textContent?.trim()).toBe('Sin clase');
    expect(stamps[0].classList.contains('at__clase-stamp--filled')).toBeFalse();
    const asignaciones = component.buildAsignaciones();
    expect(asignaciones.length).toBeGreaterThan(0);
    expect(asignaciones.every((a) => a.categoria_calculated === undefined)).toBeTrue();
  });

  it('incluye categoria_calculated solo cuando hay una clase 0–10', () => {
    const cheapest = [...component.niveles].sort((a, b) => a.importe - b.importe)[0];
    component.onClase(cheapest.id, 5);
    const withClass = component.buildAsignaciones().find((a) => a.tarifa_normalizada_id === cheapest.id);
    expect(withClass?.categoria_calculated).toBe(5);
    component.onClase(cheapest.id, '');
    const cleared = component.buildAsignaciones().find((a) => a.tarifa_normalizada_id === cheapest.id);
    expect(cleared?.categoria_calculated).toBeUndefined();
  });

  it('recorta 11 a 10 y muestra em dash en Patrón B', () => {
    component.onClase(component.niveles[0].id, 11);
    expect(component.claseValue(component.niveles[0].id)).toBe(10);

    component.niveles = [{ ...component.niveles[0], categoria: '2' }];
    component.ngOnChanges({ niveles: {} as never });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.at__clase-stamp')).toBeNull();
    expect(fixture.nativeElement.querySelector('.at__clase-dash')?.textContent?.trim()).toBe('—');
  });

  it('conserva NO_PICO y CAT guardados y no vuelve a sugerir PICO', () => {
    component.niveles = component.niveles.map((n) => ({
      ...n,
      status: 'NO_PICO',
      categoria_calculated: 5,
    }));
    component.ngOnChanges({ niveles: {} as never });
    fixture.detectChanges();

    expect(component.niveles.every((n) => component.selections.get(n.id) === 'NO_PICO')).toBeTrue();
    expect(component.niveles.every((n) => component.claseValue(n.id) === 5)).toBeTrue();
    const stamps: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.at__clase-stamp--filled');
    expect(stamps.length).toBe(component.niveles.length);
    expect(stamps[0].querySelector('.at__clase-kicker')?.textContent?.trim()).toBe('CAT');
  });

  it('emite NO_PICO y CAT 5 en Asignar status y los conserva al recargar', () => {
    for (const n of component.niveles) {
      component.onSelect(n.id, 'NO_PICO');
      component.onClase(n.id, 5);
    }
    const emitted: TarifaAsignacion[][] = [];
    component.confirm.subscribe((asignaciones) => emitted.push(asignaciones));
    component.onConfirm();

    expect(emitted.length).toBe(1);
    expect(emitted[0].length).toBe(component.niveles.length);
    expect(
      emitted[0].every((a) => a.status_codigo === 'NO_PICO' && a.categoria_calculated === 5)
    ).toBeTrue();

    component.niveles = component.niveles.map((n) => ({
      ...n,
      status: 'PENDIENTE',
      categoria_calculated: null,
    }));
    component.ngOnChanges({ niveles: {} as never });
    expect(component.niveles.every((n) => component.selections.get(n.id) === 'NO_PICO')).toBeTrue();
    expect(component.niveles.every((n) => component.claseValue(n.id) === 5)).toBeTrue();
  });

  it('no pisa una edición manual si solo cambia el catálogo', () => {
    const cheapest = [...component.niveles].sort((a, b) => a.importe - b.importe)[0];
    component.onSelect(cheapest.id, 'NO_PICO');
    component.onClase(cheapest.id, 3);
    component.catalogo = [...catalog];
    component.ngOnChanges({ catalogo: {} as never });
    expect(component.selections.get(cheapest.id)).toBe('NO_PICO');
    expect(component.claseValue(cheapest.id)).toBe(3);
  });
});
