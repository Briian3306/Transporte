import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateRangePickerComponent } from './date-range-picker.component';
import { startOfDay } from './date-range.types';

describe('DateRangePickerComponent', () => {
  let fixture: ComponentFixture<DateRangePickerComponent>;
  let component: DateRangePickerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateRangePickerComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DateRangePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('sets from then to and swaps if reversed', () => {
    const changes: unknown[] = [];
    component.valueChange.subscribe((v) => changes.push(v));

    const a = startOfDay(new Date(2026, 7, 10));
    const b = startOfDay(new Date(2026, 7, 4));
    component.selectDay({ date: a, inMonth: true, disabled: false });
    component.selectDay({ date: b, inMonth: true, disabled: false });

    expect(component.value.from?.getDate()).toBe(4);
    expect(component.value.to?.getDate()).toBe(10);
    expect(changes.length).toBe(2);
  });

  it('formats placeholder when empty', () => {
    expect(component.buttonLabel).toBe('Elegir fechas');
  });

  it('single mode picks one date and closes', () => {
    component.mode = 'single';
    component.placeholder = 'Elegir fecha';
    const a = startOfDay(new Date(2026, 7, 10));
    component.selectDay({ date: a, inMonth: true, disabled: false });
    expect(component.value.from?.getDate()).toBe(10);
    expect(component.value.to).toBeNull();
    expect(component.open).toBeFalse();
    expect(component.buttonLabel).toContain('2026');
  });

  it('accepts typed Argentine dates and formats on blur', () => {
    component.mode = 'single';
    component.allowTypedInput = true;
    const changes: unknown[] = [];
    component.valueChange.subscribe((v) => changes.push(v));

    component.textDraft = '13/6/2020';
    component.onTextBlur();

    expect(component.parseError).toBeFalse();
    expect(component.value.from?.getFullYear()).toBe(2020);
    expect(component.value.from?.getMonth()).toBe(5);
    expect(component.value.from?.getDate()).toBe(13);
    expect(component.textDraft).toBe('13/06/2020');
    expect(changes.length).toBe(1);
  });

  it('marks parse error for invalid typed dates', () => {
    component.mode = 'single';
    component.textDraft = '31/02/2020';
    component.onTextBlur();
    expect(component.parseError).toBeTrue();
    expect(component.value.from).toBeNull();
  });
});
