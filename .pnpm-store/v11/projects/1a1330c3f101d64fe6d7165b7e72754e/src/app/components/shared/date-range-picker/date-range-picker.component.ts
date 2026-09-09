import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  forwardRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  DateRangeValue,
  formatDateInputDisplay,
  formatRangeLabel,
  parseFlexibleDateInput,
  parseFlexibleDateRangeInput,
  sameDay,
  startOfDay,
} from './date-range.types';

interface CalendarDay {
  date: Date;
  inMonth: boolean;
  disabled: boolean;
}

@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './date-range-picker.component.html',
  styleUrl: './date-range-picker.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateRangePickerComponent),
      multi: true,
    },
  ],
})
export class DateRangePickerComponent implements ControlValueAccessor, OnChanges {
  @Input() value: DateRangeValue = { from: null, to: null };
  @Input() label = '';
  @Input() placeholder = 'Elegir fechas';
  @Input() disabled = false;
  @Input() minDate: Date | null = null;
  @Input() maxDate: Date | null = null;
  /** `range` = from/to; `single` = una fecha (from). */
  @Input() mode: 'range' | 'single' = 'range';
  /** When true (default), the trigger is a text field that accepts typed dates. */
  @Input() allowTypedInput = true;
  @Input() inputId = '';

  @Output() valueChange = new EventEmitter<DateRangeValue>();

  @ViewChild('dateInput') dateInput?: ElementRef<HTMLInputElement>;

  open = false;
  textDraft = '';
  parseError = false;
  /** Left month of the dual calendar. */
  viewMonth = startOfDay(new Date());
  readonly weekdays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

  private onChange: (v: DateRangeValue) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && !this.isDraftDirty()) {
      this.syncTextFromValue();
    }
  }

  get buttonLabel(): string {
    return formatRangeLabel(
      this.value,
      this.mode === 'single' && this.placeholder === 'Elegir fechas'
        ? 'Elegir fecha'
        : this.placeholder,
      this.mode
    );
  }

  get inputPlaceholder(): string {
    if (this.mode === 'single') {
      return this.placeholder === 'Elegir fechas' || this.placeholder === 'Elegir fecha'
        ? 'dd/mm/aaaa'
        : this.placeholder;
    }
    return this.placeholder === 'Elegir fechas' ? 'dd/mm/aaaa – dd/mm/aaaa' : this.placeholder;
  }

  get isSingle(): boolean {
    return this.mode === 'single';
  }

  get leftMonthLabel(): string {
    return this.monthTitle(this.viewMonth);
  }

  get rightMonth(): Date {
    return new Date(this.viewMonth.getFullYear(), this.viewMonth.getMonth() + 1, 1);
  }

  get rightMonthLabel(): string {
    return this.monthTitle(this.rightMonth);
  }

  get leftDays(): CalendarDay[] {
    return this.buildMonth(this.viewMonth);
  }

  get rightDays(): CalendarDay[] {
    return this.buildMonth(this.rightMonth);
  }

  writeValue(value: DateRangeValue | null): void {
    this.value = value ?? { from: null, to: null };
    this.syncTextFromValue();
    if (this.value.from) {
      this.viewMonth = startOfDay(
        new Date(this.value.from.getFullYear(), this.value.from.getMonth(), 1)
      );
    }
  }

  registerOnChange(fn: (v: DateRangeValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  toggle(): void {
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) {
      this.onTouched();
      if (this.value.from) {
        this.viewMonth = startOfDay(
          new Date(this.value.from.getFullYear(), this.value.from.getMonth(), 1)
        );
      }
    }
  }

  close(): void {
    this.open = false;
  }

  prevMonth(): void {
    this.viewMonth = new Date(this.viewMonth.getFullYear(), this.viewMonth.getMonth() - 1, 1);
  }

  nextMonth(): void {
    this.viewMonth = new Date(this.viewMonth.getFullYear(), this.viewMonth.getMonth() + 1, 1);
  }

  selectDay(day: CalendarDay): void {
    if (day.disabled || !day.inMonth) return;
    const picked = startOfDay(day.date);

    if (this.mode === 'single') {
      this.emit({ from: picked, to: null });
      this.close();
      this.focusInput();
      return;
    }

    let next: DateRangeValue;
    if (!this.value.from || (this.value.from && this.value.to)) {
      next = { from: picked, to: null };
    } else {
      let from = this.value.from;
      let to = picked;
      if (to < from) {
        [from, to] = [to, from];
      }
      next = { from, to };
    }

    this.emit(next);
    if (next.from && next.to) {
      this.close();
      this.focusInput();
    }
  }

  clear(event: Event): void {
    event.stopPropagation();
    this.parseError = false;
    this.emit({ from: null, to: null });
    this.focusInput();
  }

  onTextInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    this.textDraft = el.value;
    this.parseError = false;
  }

  onTextBlur(): void {
    this.commitTextDraft();
    this.onTouched();
  }

  onTextKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitTextDraft();
      if (!this.parseError && this.value.from) {
        this.close();
      }
      return;
    }
    if (event.key === 'ArrowDown' && !this.open) {
      event.preventDefault();
      this.toggle();
      return;
    }
    if (event.key === 'Escape' && this.open) {
      event.preventDefault();
      this.close();
    }
  }

  isStart(day: CalendarDay): boolean {
    return !!this.value.from && sameDay(day.date, this.value.from);
  }

  isEnd(day: CalendarDay): boolean {
    return !!this.value.to && sameDay(day.date, this.value.to);
  }

  inRange(day: CalendarDay): boolean {
    if (!this.value.from || !this.value.to) return false;
    const t = startOfDay(day.date).getTime();
    return t > this.value.from.getTime() && t < this.value.to.getTime();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.open) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open) this.close();
  }

  private commitTextDraft(): void {
    const raw = this.textDraft.trim();
    if (!raw) {
      this.parseError = false;
      this.emit({ from: null, to: null });
      return;
    }

    if (this.mode === 'single') {
      const parsed = parseFlexibleDateInput(raw);
      if (!parsed || this.isOutOfBounds(parsed)) {
        this.parseError = true;
        return;
      }
      this.parseError = false;
      this.emit({ from: parsed, to: null });
      return;
    }

    const expectsRange = /[–—]/.test(raw) || /\s-\s/.test(raw);
    const range = parseFlexibleDateRangeInput(raw);
    if (
      !range.from ||
      this.isOutOfBounds(range.from) ||
      (expectsRange && !range.to) ||
      (range.to != null && this.isOutOfBounds(range.to))
    ) {
      this.parseError = true;
      return;
    }

    let from = range.from;
    let to = range.to;
    if (from && to && to < from) {
      [from, to] = [to, from];
    }
    this.parseError = false;
    this.emit({ from, to });
  }

  private emit(next: DateRangeValue): void {
    this.value = next;
    this.syncTextFromValue();
    this.valueChange.emit(next);
    this.onChange(next);
  }

  private syncTextFromValue(): void {
    if (this.mode === 'single') {
      this.textDraft = formatDateInputDisplay(this.value.from);
      return;
    }
    if (this.value.from && this.value.to) {
      this.textDraft = `${formatDateInputDisplay(this.value.from)} – ${formatDateInputDisplay(this.value.to)}`;
      return;
    }
    if (this.value.from) {
      this.textDraft = formatDateInputDisplay(this.value.from);
      return;
    }
    this.textDraft = '';
  }

  private isDraftDirty(): boolean {
    const expected =
      this.mode === 'single'
        ? formatDateInputDisplay(this.value.from)
        : this.value.from && this.value.to
          ? `${formatDateInputDisplay(this.value.from)} – ${formatDateInputDisplay(this.value.to)}`
          : formatDateInputDisplay(this.value.from);
    return this.textDraft.trim() !== expected.trim() && this.textDraft.trim() !== '';
  }

  private focusInput(): void {
    queueMicrotask(() => this.dateInput?.nativeElement.focus());
  }

  private monthTitle(d: Date): string {
    const raw = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(d);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  private buildMonth(monthStart: Date): CalendarDay[] {
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: CalendarDay[] = [];

    for (let i = 0; i < startPad; i++) {
      const d = new Date(year, month, -startPad + i + 1);
      cells.push({ date: d, inMonth: false, disabled: true });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = startOfDay(new Date(year, month, day));
      cells.push({ date: d, inMonth: true, disabled: this.isOutOfBounds(d) });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      cells.push({ date: d, inMonth: false, disabled: true });
    }
    return cells;
  }

  private isOutOfBounds(d: Date): boolean {
    if (this.minDate && startOfDay(d) < startOfDay(this.minDate)) return true;
    if (this.maxDate && startOfDay(d) > startOfDay(this.maxDate)) return true;
    return false;
  }
}
