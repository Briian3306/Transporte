import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TarifarioEditorRow } from '../models/tarifario.contracts';
import { MISSING_IMPORTE_LABEL } from './tarifario.helpers';
import {
  TarifarioEditorBoardComponent,
  groupCurrentAmounts,
} from './tarifario-editor-board.component';

function cell(importe: number | null, tarifaId: string | null = null): TarifarioEditorRow['no_pico'] {
  return {
    tarifa_id: tarifaId,
    current_tarifa_importe_id: tarifaId,
    importe,
    fecha_actualizacion: importe == null ? null : '2026-07-01T00:00:00Z',
  };
}

function row(categoria: number, noPico: number | null, pico: number | null): TarifarioEditorRow {
  return {
    categoria,
    no_pico: cell(noPico, noPico == null ? null : `t-${categoria}-np`),
    pico: cell(pico, pico == null ? null : `t-${categoria}-p`),
  };
}

describe('TarifarioEditorBoardComponent', () => {
  let fixture: ComponentFixture<TarifarioEditorBoardComponent>;
  let component: TarifarioEditorBoardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TarifarioEditorBoardComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TarifarioEditorBoardComponent);
    component = fixture.componentInstance;
    component.rows = [row(1, 5500, 6000), row(2, 7300, null)];
    component.drafts = {
      1: { no_pico: '', pico: '' },
      2: { no_pico: '', pico: '' },
    };
    component.allowAddCategoria = true;
    component.categoriaCount = 2;
    fixture.detectChanges();
  });

  it('renderiza todas las categorías suministradas', () => {
    const cats = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.tf__cat-cell'),
    ).map((el) => el.textContent?.trim());
    expect(cats).toEqual(['1', '2']);
  });

  it('muestra em dash cuando falta el importe actual', () => {
    const root = fixture.nativeElement as HTMLElement;
    const picoCat2 = root.querySelector('tr:nth-child(2) .tf__actual[data-lane="pico"]') as HTMLElement;
    expect(picoCat2.classList.contains('tf__missing')).toBeTrue();
    expect(picoCat2.textContent).toContain(MISSING_IMPORTE_LABEL);
  });

  it('un Nuevo vacío no marca dirty ni inválido', () => {
    expect(component.isDirty(1, 'NO_PICO')).toBeFalse();
    expect(component.isInvalid(1, 'NO_PICO')).toBeFalse();
    expect(component.draftValue(1, 'NO_PICO')).toBe('');
  });

  it('marca input inválido y emite el borrador', () => {
    const spy = jasmine.createSpy('draftChange');
    component.draftChange.subscribe(spy);
    component.setDraft(1, 'NO_PICO', 'abc');
    fixture.detectChanges();
    expect(spy).toHaveBeenCalledWith({ categoria: 1, status: 'NO_PICO', value: 'abc' });
    component.drafts = { ...component.drafts, 1: { no_pico: 'abc', pico: '' } };
    fixture.detectChanges();
    expect(component.isInvalid(1, 'NO_PICO')).toBeTrue();
    expect(component.isInvalid(2, 'NO_PICO')).toBeFalse();
    const input = (fixture.nativeElement as HTMLElement).querySelector(
      '.tf__input--invalid',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
  });

  it('renderiza montos detectados junto a la celda', () => {
    component.detected = {
      '2:NO_PICO': [{ valor: 12500, count: 12 }],
      '2:PICO': [
        { valor: 15500, count: 3 },
        { valor: 16000, count: 2 },
      ],
    };
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toContain('$12.500,00 (12)');
    expect(text).toContain('$15.500,00 (3)');
    expect(text).toContain('$16.000,00 (2)');
    expect(text).not.toContain('×12');
  });

  it('Tab recorre solo inputs Nuevo y omite Historial', () => {
    const root = fixture.nativeElement as HTMLElement;
    root.querySelectorAll('.tf__hist').forEach((btn) => {
      expect(btn.getAttribute('tabindex')).toBe('-1');
    });
    const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('.tf__input'));
    expect(inputs.length).toBe(4);
    inputs[0].focus();
    inputs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('mantiene etiquetas persistentes Actual, Detectado y Nuevo', () => {
    const root = fixture.nativeElement as HTMLElement;
    const subs = Array.from(root.querySelectorAll('.tf__sub')).map((el) => el.textContent?.trim());
    expect(subs).toEqual(['Actual', 'Detectado', 'Nuevo', 'Actual', 'Detectado', 'Nuevo']);
    const cellLabels = Array.from(root.querySelectorAll('.tf__cell-label')).map((el) =>
      el.textContent?.trim(),
    );
    expect(cellLabels.filter((label) => label === 'Actual').length).toBeGreaterThan(0);
    expect(cellLabels.filter((label) => label === 'Detectado').length).toBeGreaterThan(0);
    expect(cellLabels.filter((label) => label === 'Nuevo').length).toBeGreaterThan(0);
  });

  it('el campo Nuevo tiene placeholder, aria-label y borde sólido editable', () => {
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('.tf__input')!;
    expect(input.placeholder).toBe('Ingresar nueva tarifa');
    expect(input.getAttribute('aria-label')).toBe('Nuevo NO_PICO categoría 1');
    const style = getComputedStyle(input);
    expect(style.borderTopStyle).toBe('solid');
    expect(style.backgroundColor).not.toBe('rgb(255, 255, 255)');
    expect(style.fontVariantNumeric).toContain('tabular-nums');
  });

  it('marca inválido y foco con clases visibles', () => {
    component.drafts = { ...component.drafts, 1: { no_pico: 'abc', pico: '' } };
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '[aria-label="Nuevo NO_PICO categoría 1"]',
    )!;
    expect(input.classList.contains('tf__input--invalid')).toBeTrue();
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(input.classList.contains('tf__input--focus')).toBeTrue();
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(input.classList.contains('tf__input--focus')).toBeFalse();
  });

  it('muestra montos detectados con estación, color y conteo', () => {
    component.detected = {
      '1:NO_PICO': [
        {
          valor: 12500,
          count: 12,
          estacionId: 'dock',
          estacionNombre: 'Dock Sud',
          color: '#6D28D9',
          candidateId: 'cand-dock',
        },
      ],
    };
    fixture.detectChanges();
    const item = (fixture.nativeElement as HTMLElement).querySelector('.tf__detected-item') as HTMLElement;
    expect(item).toBeTruthy();
    expect(item.textContent).toContain('Dock Sud');
    expect(item.textContent).toContain('$12.500,00 (12)');
    expect(item.textContent).not.toContain('×12');
    expect(item.querySelector('.tf__trace-swatch')).toBeTruthy();
    expect(item.querySelector('.tf__trace-name')?.textContent?.trim()).toBe('Dock Sud');
  });

  it('emite candidateSelected y no muta el borrador al mostrar o elegir un detectado', () => {
    const selected = jasmine.createSpy('candidateSelected');
    const draft = jasmine.createSpy('draftChange');
    component.candidateSelected.subscribe(selected);
    component.draftChange.subscribe(draft);
    component.detected = {
      '1:NO_PICO': [
        {
          valor: 12500,
          count: 12,
          estacionId: 'dock',
          estacionNombre: 'Dock Sud',
          color: '#6D28D9',
          candidateId: 'cand-dock',
        },
      ],
    };
    fixture.detectChanges();
    expect(component.draftValue(1, 'NO_PICO')).toBe('');
    expect(draft).not.toHaveBeenCalled();
    const btn = (fixture.nativeElement as HTMLElement).querySelector(
      '.tf__detected-item',
    ) as HTMLButtonElement;
    btn.click();
    expect(selected).toHaveBeenCalledWith({
      categoria: 1,
      status: 'NO_PICO',
      candidate: jasmine.objectContaining({ candidateId: 'cand-dock', valor: 12500, count: 12 }),
    });
    expect(draft).not.toHaveBeenCalled();
    expect(component.draftValue(1, 'NO_PICO')).toBe('');
  });

  it('renders one category-level action without state text or dots', () => {
    const root = fixture.nativeElement as HTMLElement;
    const actionCell = root.querySelector('.tf__actions-cell') as HTMLElement;
    expect(actionCell.querySelectorAll('.tf__state-btn').length).toBe(1);
    expect(actionCell.textContent).not.toContain('Habilitada');
    expect(actionCell.textContent).not.toContain('Deshabilitada');
    expect(actionCell.querySelector('.tf__state-dot')).toBeFalsy();
    const action = actionCell.querySelector<HTMLButtonElement>('.tf__state-btn');
    expect(action?.querySelector('.fa-trash')).toBeTruthy();
    expect(action?.getAttribute('title')).toBe('Deshabilitar categoría 1');
    expect(action?.getAttribute('aria-label')).toBe('Deshabilitar categoría 1');
  });

  it('emits one category-level action for both PICO and NO_PICO', () => {
    const spy = jasmine.createSpy('categoryStateChange');
    component.categoryStateChange.subscribe(spy);
    component.toggleCategoryState(component.rows[0]);
    expect(spy).toHaveBeenCalledWith({
      categoria: 1,
      enabled: false,
      tarifaIds: ['t-1-np', 't-1-p'],
    });
  });

  it('places the add row after the last persisted category', () => {
    component.rows = [row(7, 8238, null), row(8, null, 23146), row(9, null, null)];
    component.categoriaCount = 9;
    component.allowAddCategoria = true;
    component.nextCategoria = 10;
    component.nextCategoryAction = 'DRAFT';
    fixture.detectChanges();
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody > tr'));
    expect(rows[2].querySelector('.tf__add')).toBeTruthy();
    expect(rows[2].querySelector('.tf__cat-cell')).toBeFalsy();
  });

  it('hides disabled-only and unadded trailing categories', () => {
    const disabled = row(8, 23000, 23100);
    disabled.no_pico.enabled = false;
    disabled.pico.enabled = false;
    component.rows = [row(7, 8238, 2315), disabled, row(9, null, null)];
    component.drafts = {
      7: { no_pico: '', pico: '' },
      8: { no_pico: '', pico: '' },
      9: { no_pico: '', pico: '' },
    };
    component.nextCategoria = 8;
    component.nextCategoryAction = 'ENABLE';
    component.draftCategories = [];
    fixture.detectChanges();

    expect(component.visibleRows().map((item) => item.categoria)).toEqual([7]);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.tf__cat-cell').length).toBe(1);
    expect((fixture.nativeElement as HTMLElement).querySelector('.tf__add')?.textContent).toContain('Habilitar categoría 8');
  });

  it('hides a disabled category even when Nuevo still has an amount', () => {
    const disabled = row(8, 23000, 23100);
    disabled.no_pico.enabled = false;
    disabled.pico.enabled = false;
    component.rows = [row(7, 8238, 2315), disabled];
    component.drafts = {
      7: { no_pico: '', pico: '' },
      8: { no_pico: '24000', pico: '' },
    };
    component.nextCategoria = 8;
    component.nextCategoryAction = 'ENABLE';
    component.draftCategories = [];
    fixture.detectChanges();

    expect(component.visibleRows().map((item) => item.categoria)).toEqual([7]);
  });

  it('shows a disabled category only after Agregar/Habilitar', () => {
    const disabled = row(8, 23000, 23100);
    disabled.no_pico.enabled = false;
    disabled.pico.enabled = false;
    component.rows = [row(7, 8238, 2315), disabled];
    component.drafts = {
      7: { no_pico: '', pico: '' },
      8: { no_pico: '', pico: '' },
    };
    component.nextCategoria = 9;
    component.nextCategoryAction = 'DRAFT';
    component.draftCategories = [8];
    fixture.detectChanges();

    expect(component.visibleRows().map((item) => item.categoria)).toEqual([7, 8]);
  });

  it('shows only the explicitly added blank category', () => {
    component.rows = [row(7, 8238, 2315), row(8, null, null), row(9, null, null)];
    component.drafts = {
      7: { no_pico: '', pico: '' },
      8: { no_pico: '', pico: '' },
      9: { no_pico: '', pico: '' },
    };
    component.draftCategories = [8];
    component.nextCategoria = 9;
    component.nextCategoryAction = 'DRAFT';
    fixture.detectChanges();

    expect(component.visibleRows().map((item) => item.categoria)).toEqual([7, 8]);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.tf__cat-cell').length).toBe(2);
  });

  it('keeps leading blank categories so the visible sequence starts at category 1', () => {
    component.rows = [row(1, null, null), row(2, 7300, null), row(3, 8200, null), row(4, 9100, null), row(5, null, null)];
    component.drafts = {
      1: { no_pico: '', pico: '' },
      2: { no_pico: '', pico: '' },
      3: { no_pico: '', pico: '' },
      4: { no_pico: '', pico: '' },
      5: { no_pico: '', pico: '' },
    };
    component.draftCategories = [];
    fixture.detectChanges();

    expect(component.visibleRows().map((item) => item.categoria)).toEqual([1, 2, 3, 4]);
  });

  it('muestra un detectado resuelto como solo lectura sin emitir una selección', () => {
    const selected = jasmine.createSpy('candidateSelected');
    component.candidateSelected.subscribe(selected);
    component.detected = {
      '1:NO_PICO': [
        {
          valor: 12500,
          count: 12,
          estacionId: 'dock',
          estacionNombre: 'Dock Sud',
          color: '#6D28D9',
          candidateId: 'cand-resuelto',
          readOnly: true,
        } as unknown as (typeof component.detected)['1:NO_PICO'][number],
      ],
    };
    fixture.detectChanges();

    const item = (fixture.nativeElement as HTMLElement).querySelector('.tf__detected-item') as HTMLButtonElement;
    expect(item.disabled).toBeTrue();
    item.click();
    expect(selected).not.toHaveBeenCalled();
  });

  it('cuando los actuales agrupados coinciden muestra un monto y todos los nombres', () => {
    component.currentStations = {
      '1:NO_PICO': [
        { estacionId: 'dock', estacionNombre: 'Dock Sud', color: '#6D28D9', importe: 28740.39 },
        { estacionId: 'hudson', estacionNombre: 'Hudson', color: '#15803D', importe: 28740.39 },
      ],
    };
    fixture.detectChanges();
    const cell = (fixture.nativeElement as HTMLElement).querySelector(
      'tr:first-child .tf__actual[data-lane="nopico"]',
    ) as HTMLElement;
    expect(cell.querySelectorAll('.tf__amount').length).toBe(1);
    expect(cell.textContent).toContain('Dock Sud');
    expect(cell.textContent).toContain('Hudson');
    expect(cell.textContent).toContain('28.740');
  });

  it('cuando los actuales agrupados difieren muestra un monto por estación y no usa el ancla', () => {
    component.rows = [row(1, 1000, 6000)];
    component.currentStations = {
      '1:NO_PICO': [
        { estacionId: 'dock', estacionNombre: 'Dock Sud', color: '#6D28D9', importe: 28740.39 },
        { estacionId: 'hudson', estacionNombre: 'Hudson', color: '#15803D', importe: 15500 },
      ],
    };
    fixture.detectChanges();
    const cell = (fixture.nativeElement as HTMLElement).querySelector(
      'tr:first-child .tf__actual[data-lane="nopico"]',
    ) as HTMLElement;
    expect(cell.querySelectorAll('.tf__amount').length).toBe(2);
    expect(cell.textContent).toContain('Dock Sud');
    expect(cell.textContent).toContain('Hudson');
    expect(cell.textContent).toContain('28.740');
    expect(cell.textContent).toContain('15.500');
    expect(cell.textContent).not.toContain(component.displayActual(1000));
  });

  it('ordena Actual, Detectado y Nuevo por carril para NO_PICO y luego PICO', () => {
    const cells = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr:first-child td'),
    ).map((el) => ({
      role: el.getAttribute('data-role'),
      lane: el.getAttribute('data-lane'),
    }));
    expect(cells).toEqual([
      { role: 'actual', lane: 'nopico' },
      { role: 'detectado', lane: 'nopico' },
      { role: 'nuevo', lane: 'nopico' },
      { role: 'actual', lane: 'pico' },
      { role: 'detectado', lane: 'pico' },
      { role: 'nuevo', lane: 'pico' },
      { role: null, lane: null },
    ]);
  });

  it('emite historyRequest desde Historial y Enter recorre inputs Nuevo', () => {
    const spy = jasmine.createSpy('historyRequest');
    component.historyRequest.subscribe(spy);
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('.tf__hist') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledWith({ row: component.rows[0], status: 'NO_PICO' });
    const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('.tf__input'));
    inputs[0].focus();
    inputs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('muestra la revisión con botones de status, sin sentido, IVA ni cambios de Nuevo', () => {
    component.reviewRows = [
      {
        candidateId: 'cand-rev',
        valor: 20792.47,
        count: 3,
        categoria: 8,
        status: null,
        estacionNombre: 'Varela',
        color: '#6D28D9',
      },
    ];
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const review = root.querySelector('[data-role="revision"]') as HTMLElement;
    expect(review).toBeTruthy();
    expect(review.textContent).toContain('$20.792,47 (3)');
    expect(review.textContent).toContain('Varela');
    const statusSpy = jasmine.createSpy('reviewStatusChange');
    const draftSpy = jasmine.createSpy('draftChange');
    component.reviewStatusChange.subscribe(statusSpy);
    component.draftChange.subscribe(draftSpy);
    const pico = review.querySelector('button[aria-label="Marcar como Pico"]') as HTMLButtonElement;
    pico.click();
    expect(statusSpy).toHaveBeenCalledWith({ candidateId: 'cand-rev', status: 'PICO' });
    expect(draftSpy).not.toHaveBeenCalled();
    expect(review.querySelector('select')).toBeNull();
    expect(review.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('emite Todas No pico y Todas Pico para las filas de revisión', () => {
    component.reviewRows = [
      { candidateId: 'cand-a', valor: 1000, count: 1, categoria: 7, status: null, estacionNombre: 'A', color: '#6D28D9' },
      { candidateId: 'cand-b', valor: 2000, count: 1, categoria: 7, status: null, estacionNombre: 'B', color: '#15803D' },
    ];
    fixture.detectChanges();
    const bulkSpy = jasmine.createSpy('bulkReviewStatus');
    component.bulkReviewStatus.subscribe(bulkSpy);
    const root = fixture.nativeElement as HTMLElement;
    const toolbar = root.querySelector('[data-role="revision-toolbar"]') as HTMLElement;
    expect(toolbar).toBeTruthy();
    (toolbar.querySelector('button[aria-label="Marcar todas como Pico"]') as HTMLButtonElement).click();
    expect(bulkSpy).toHaveBeenCalledWith('PICO');
    (toolbar.querySelector('button[aria-label="Marcar todas como No pico"]') as HTMLButtonElement).click();
    expect(bulkSpy).toHaveBeenCalledWith('NO_PICO');
  });

  it('muestra un input de categoría obligatorio cuando el proveedor no la informa', () => {
    component.reviewRows = [
      {
        candidateId: 'cand-null',
        valor: 5000,
        count: 1,
        categoria: null,
        status: null,
        requiresCategoriaInput: true,
        categoriaError: 'Indicá una categoría de 0 a 10.',
        estacionNombre: 'Varela',
        color: '#6D28D9',
      },
    ];
    fixture.detectChanges();
    const categorySpy = jasmine.createSpy('reviewCategoryChange');
    component.reviewCategoryChange.subscribe(categorySpy);
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('#tf-review-cat-cand-null') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.getAttribute('aria-label')).toBe('Categoría de 0 a 10');
    expect(input.required).toBeTrue();
    expect(root.querySelector('#tf-review-cat-err-cand-null')?.textContent).toContain('0 a 10');
    input.value = '4';
    input.dispatchEvent(new Event('change'));
    expect(categorySpy).toHaveBeenCalledWith({ candidateId: 'cand-null', categoria: 4 });
  });
});

describe('groupCurrentAmounts', () => {
  it('agrupa importes idénticos y separa los distintos', () => {
    const shared = groupCurrentAmounts([
      { estacionId: 'a', estacionNombre: 'A', color: '#6D28D9', importe: 10 },
      { estacionId: 'b', estacionNombre: 'B', color: '#15803D', importe: 10 },
    ]);
    expect(shared).toEqual({
      kind: 'shared',
      importe: 10,
      stations: [
        { estacionId: 'a', estacionNombre: 'A', color: '#6D28D9', importe: 10 },
        { estacionId: 'b', estacionNombre: 'B', color: '#15803D', importe: 10 },
      ],
    });
    const split = groupCurrentAmounts([
      { estacionId: 'a', estacionNombre: 'A', color: '#6D28D9', importe: 10 },
      { estacionId: 'b', estacionNombre: 'B', color: '#15803D', importe: 20 },
    ]);
    expect(split.kind).toBe('split');
    if (split.kind === 'split') {
      expect(split.stations.map((s) => s.importe)).toEqual([10, 20]);
    }
  });
});
