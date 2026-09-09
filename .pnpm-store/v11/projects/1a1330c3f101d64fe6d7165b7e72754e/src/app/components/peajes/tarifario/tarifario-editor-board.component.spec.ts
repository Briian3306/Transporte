import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TarifarioEditorRow } from '../models/tarifario.contracts';
import { MISSING_IMPORTE_LABEL } from './tarifario.helpers';
import { TarifarioEditorBoardComponent } from './tarifario-editor-board.component';

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
    expect(text).toContain('12.500');
    expect(text).toContain('×12');
    expect(text).toContain('15.500');
    expect(text).toContain('16.000');
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
});
