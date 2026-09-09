import {
  Component,
  Input,
  Output,
  EventEmitter,
  forwardRef,
  OnInit,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  HostListener,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type DisplayFieldFn<T> = (item: T) => string;
export type ValueFieldFn<T> = (item: T) => string | number;
export type FilterFn<T> = (items: T[], search: string) => T[];

@Component({
  selector: 'app-autocomplete-generic',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './autocomplete-generic.component.html',
  styleUrl: './autocomplete-generic.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutocompleteGenericComponent),
      multi: true,
    },
  ],
})
export class AutocompleteGenericComponent<T extends object = object>
  implements ControlValueAccessor, OnInit, OnChanges
{
  @Input() items: T[] = [];
  @Input() displayField: keyof T | DisplayFieldFn<T> = 'nombre' as keyof T;
  @Input() valueField: keyof T | ValueFieldFn<T> = 'id' as keyof T;
  @Input() filterFields: (keyof T)[] | FilterFn<T> | null = null;
  @Input() placeholder: string = 'Buscar...';
  @Input() label: string = '';
  @Input() required: boolean = false;
  @Input() error: boolean = false;
  @Input() errorMessage: string = '';
  @Input() disabled: boolean = false;
  @Input() emptyMessage: string = 'No se encontraron resultados';

  @Output() selected = new EventEmitter<T | null>();

  @ViewChild('inputRef', { static: false }) inputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('dropdownRef', { static: false })
  dropdownRef!: ElementRef<HTMLDivElement>;

  searchText: string = '';
  filteredItems: T[] = [];
  isOpen: boolean = false;
  selectedItem: T | null = null;
  highlightedIndex: number = -1;

  private onChange: (value: string | number | null) => void = () => {};
  private onTouched = () => {};

  ngOnInit(): void {
    this.filteredItems = this.items ? [...this.items] : [];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items'] && this.items) {
      this.filteredItems = [...this.items];
      if (this.selectedItem) {
        const currentValue = this.getItemValue(this.selectedItem);
        const existe = this.items.some(
          (i) => this.normalizeValue(this.getItemValue(i)) === this.normalizeValue(currentValue)
        );
        if (!existe) {
          this.clearSelection();
        } else {
          this.searchText = this.getDisplayValue(this.selectedItem);
        }
      }
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.inputRef?.nativeElement && this.dropdownRef?.nativeElement) {
      const clickedInside =
        this.inputRef.nativeElement.contains(event.target as Node) ||
        this.dropdownRef.nativeElement.contains(event.target as Node);
      if (!clickedInside) {
        this.closeDropdown();
      }
    }
  }

  onInputFocus(): void {
    this.isOpen = true;
    this.applyFilter();
  }

  onInputBlur(): void {
    setTimeout(() => {
      if (
        this.dropdownRef?.nativeElement &&
        !this.dropdownRef.nativeElement.contains(document.activeElement)
      ) {
        this.closeDropdown();
      }
    }, 200);
  }

  onInputChange(): void {
    this.applyFilter();
    this.isOpen = true;
    this.highlightedIndex = -1;

    if (!this.searchText.trim() && this.selectedItem) {
      this.clearSelection();
    } else if (this.searchText.trim() && this.selectedItem) {
      if (this.searchText !== this.getDisplayValue(this.selectedItem)) {
        this.selectedItem = null;
        this.onChange('');
        this.selected.emit(null);
      }
    }
  }

  applyFilter(): void {
    const search = this.searchText.toLowerCase().trim();
    if (!this.items) {
      this.filteredItems = [];
      return;
    }
    if (typeof this.filterFields === 'function') {
      this.filteredItems = this.filterFields(this.items, search);
      return;
    }
    if (!search) {
      this.filteredItems = [...this.items];
      return;
    }
    const filterKeys = this.filterFields;
    if (Array.isArray(filterKeys) && filterKeys.length > 0) {
      this.filteredItems = this.items.filter((item) =>
        filterKeys.some((key: keyof T) => {
          const val = item[key];
          return val != null && String(val).toLowerCase().includes(search);
        })
      );
    } else {
      this.filteredItems = this.items.filter((item) =>
        this.getDisplayValue(item).toLowerCase().includes(search)
      );
    }
  }

  selectItem(item: T): void {
    this.selectedItem = item;
    this.searchText = this.getDisplayValue(item);
    const value = this.getItemValue(item);
    this.onChange(value);
    this.onTouched();
    this.selected.emit(item);
    this.closeDropdown();
  }

  clearSelection(): void {
    this.selectedItem = null;
    this.searchText = '';
    this.onChange('');
    this.onTouched();
    this.selected.emit(null);
    this.filteredItems = this.items ? [...this.items] : [];
    this.closeDropdown();
  }

  closeDropdown(): void {
    this.isOpen = false;
    this.highlightedIndex = -1;
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.isOpen || this.filteredItems.length === 0) {
      if (event.key === 'Enter' || event.key === 'ArrowDown') {
        this.isOpen = true;
        this.applyFilter();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedIndex = Math.min(
          this.highlightedIndex + 1,
          this.filteredItems.length - 1
        );
        this.scrollToHighlighted();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, -1);
        this.scrollToHighlighted();
        break;
      case 'Enter':
        event.preventDefault();
        if (
          this.highlightedIndex >= 0 &&
          this.highlightedIndex < this.filteredItems.length
        ) {
          this.selectItem(this.filteredItems[this.highlightedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.closeDropdown();
        break;
    }
  }

  scrollToHighlighted(): void {
    if (this.dropdownRef?.nativeElement && this.highlightedIndex >= 0) {
      const items = this.dropdownRef.nativeElement.querySelectorAll('.dropdown-item');
      if (items[this.highlightedIndex]) {
        items[this.highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }

  getDisplayValue(item: T): string {
    if (typeof this.displayField === 'function') {
      return this.displayField(item);
    }
    const val = item[this.displayField];
    return val != null ? String(val) : '';
  }

  getItemValue(item: T): string | number {
    if (typeof this.valueField === 'function') {
      return this.valueField(item);
    }
    const val = item[this.valueField];
    if (val == null) return '';
    if (typeof val === 'number') return val;
    return String(val);
  }

  private normalizeValue(v: string | number): string {
    if (v == null) return '';
    return String(v);
  }

  writeValue(value: string | number | null | undefined): void {
    if (value !== '' && value != null && this.items?.length) {
      const normalized = this.normalizeValue(value);
      const found = this.items.find(
        (i) => this.normalizeValue(this.getItemValue(i)) === normalized
      );
      if (found) {
        this.selectedItem = found;
        this.searchText = this.getDisplayValue(found);
      } else {
        this.selectedItem = null;
        this.searchText = '';
      }
    } else {
      this.selectedItem = null;
      this.searchText = '';
    }
  }

  registerOnChange(fn: (value: string | number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
