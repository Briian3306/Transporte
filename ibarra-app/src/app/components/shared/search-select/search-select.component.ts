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
import { SearchSelectOption } from './search-select.types';

@Component({
  selector: 'app-search-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-select.component.html',
  styleUrl: './search-select.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchSelectComponent),
      multi: true,
    },
  ],
})
export class SearchSelectComponent implements ControlValueAccessor {
  @Input() options: readonly SearchSelectOption[] = [];
  @Input() value: string | null = null;
  @Input() label = '';
  @Input() placeholder = 'Buscar…';
  @Input() maxResults = 10;
  @Input() disabled = false;
  @Input() emptyMessage = 'Sin resultados';
  @Input() clearable = true;
  /**
   * Con query vacío, lista todas las opciones (sin tope `maxResults`).
   * Usar en Plantilla u otros catálogos cortos donde conviene ver el listado completo.
   */
  @Input() showAllWhenEmpty = false;

  @Output() valueChange = new EventEmitter<string | null>();

  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement> | HTMLInputElement;

  query = '';
  open = false;
  highlightedIndex = -1;

  private onChange: (v: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  get selectedOption(): SearchSelectOption | null {
    if (!this.value) return null;
    return this.options.find((o) => o.id === this.value) ?? { id: this.value, label: this.value };
  }

  get filteredOptions(): SearchSelectOption[] {
    const q = this.query.trim().toLowerCase();
    let list = this.options.filter((o) => o.id !== this.value);
    if (q) {
      list = list.filter((o) => o.label.toLowerCase().includes(q)).slice(0, this.maxResults);
    } else if (!this.showAllWhenEmpty) {
      list = list.slice(0, this.maxResults);
    }
    return list;
  }

  get showClear(): boolean {
    return this.clearable && !this.disabled && !!this.value;
  }

  focusInput(): void {
    const el = this.inputEl;
    if (!el) return;
    if ('nativeElement' in el) {
      el.nativeElement.focus();
    } else {
      el.focus();
    }
  }

  writeValue(value: string | null): void {
    this.value = value ?? null;
  }

  registerOnChange(fn: (v: string | null) => void): void {
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
    this.open = true;
    this.onTouched();
  }

  onFocus(): void {
    if (this.disabled) return;
    this.open = true;
    this.highlightedIndex = this.filteredOptions.length ? 0 : -1;
    this.onTouched();
  }

  selectOption(opt: SearchSelectOption): void {
    if (this.disabled) return;
    this.emit(opt.id);
    this.query = '';
    this.open = false;
    this.highlightedIndex = -1;
  }

  clear(event?: Event): void {
    event?.stopPropagation();
    if (this.disabled || !this.clearable) return;
    this.emit(null);
    this.query = '';
    this.open = true;
    this.highlightedIndex = this.filteredOptions.length ? 0 : -1;
    queueMicrotask(() => this.focusInput());
  }

  onKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.open = false;
      return;
    }
    if (ev.key === 'Backspace' && !this.query && this.value && this.clearable) {
      this.clear();
      return;
    }

    if (ev.key === 'ArrowDown' && !this.open) {
      ev.preventDefault();
      this.open = true;
      this.highlightedIndex = 0;
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

  private emit(next: string | null): void {
    this.value = next;
    this.valueChange.emit(next);
    this.onChange(next);
  }
}
