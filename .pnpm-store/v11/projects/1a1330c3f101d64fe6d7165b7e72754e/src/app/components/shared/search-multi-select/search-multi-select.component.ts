import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  forwardRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  SearchMultiSelectBadgeTone,
  SearchMultiSelectMode,
  SearchMultiSelectOption,
} from './search-multi-select.types';

@Component({
  selector: 'app-search-multi-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-multi-select.component.html',
  styleUrl: './search-multi-select.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchMultiSelectComponent),
      multi: true,
    },
  ],
})
export class SearchMultiSelectComponent implements ControlValueAccessor {
  @Input() options: readonly SearchMultiSelectOption[] = [];
  @Input() value: readonly string[] = [];
  @Input() label = '';
  @Input() placeholder = 'Buscar…';
  @Input() maxResults = 10;
  @Input() disabled = false;
  @Input() emptyMessage = 'Sin resultados';
  @Input() badgeTone: SearchMultiSelectBadgeTone = 'signal';
  /** `single` = un valor (reemplaza); `multi` = chips acumulables. */
  @Input() mode: SearchMultiSelectMode = 'multi';
  /** En modo single, oculta la × del chip (p. ej. empresa fijada en wizard). */
  @Input() clearable = true;

  @Output() valueChange = new EventEmitter<string[]>();

  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement> | HTMLInputElement;

  focusInput(): void {
    const el = this.inputEl;
    if (!el) return;
    if ('nativeElement' in el) {
      el.nativeElement.focus();
    } else {
      el.focus();
    }
  }
  query = '';
  open = false;
  highlightedIndex = -1;

  private onChange: (v: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  get selectedOptions(): SearchMultiSelectOption[] {
    const map = new Map(this.options.map((o) => [o.id, o]));
    return this.value
      .map((id) => map.get(id) ?? { id, label: id })
      .filter(Boolean);
  }

  get filteredOptions(): SearchMultiSelectOption[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return [];
    const selected = new Set(this.value);
    return this.options
      .filter((o) => !selected.has(o.id) && o.label.toLowerCase().includes(q))
      .slice(0, this.maxResults);
  }

  writeValue(value: string[] | null): void {
    this.value = value ?? [];
  }

  registerOnChange(fn: (v: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onQueryChange(q: string): void {
    this.query = q;
    this.highlightedIndex = 0;
    this.open = q.trim().length > 0;
    this.onTouched();
  }

  onFocus(): void {
    if (this.query.trim().length > 0) {
      this.open = true;
    }
  }

  selectOption(opt: SearchMultiSelectOption): void {
    if (this.disabled) return;
    if (this.mode === 'single') {
      this.emit([opt.id]);
    } else {
      if (this.value.includes(opt.id)) return;
      this.emit([...this.value, opt.id]);
    }
    this.query = '';
    this.open = false;
    this.highlightedIndex = -1;
    if (this.mode === 'multi') {
      queueMicrotask(() => this.focusInput());
    }
  }

  removeId(id: string, event?: Event): void {
    event?.stopPropagation();
    if (this.disabled || !this.clearable) return;
    this.emit(this.value.filter((x) => x !== id));
  }

  get showChipClear(): boolean {
    return this.clearable && !this.disabled;
  }

  onKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.open = false;
      return;
    }
    if (ev.key === 'Backspace' && !this.query && this.value.length) {
      this.removeId(this.value[this.value.length - 1]);
      return;
    }
    const list = this.filteredOptions;
    if (!list.length) return;

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.open = true;
      this.highlightedIndex = Math.min(this.highlightedIndex + 1, list.length - 1);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
    } else if (ev.key === 'Enter' && this.open) {
      ev.preventDefault();
      const idx = this.highlightedIndex >= 0 ? this.highlightedIndex : 0;
      const opt = list[idx];
      if (opt) this.selectOption(opt);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.open) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.open = false;
    }
  }

  private emit(next: string[]): void {
    this.value = next;
    this.valueChange.emit(next);
    this.onChange(next);
  }
}
