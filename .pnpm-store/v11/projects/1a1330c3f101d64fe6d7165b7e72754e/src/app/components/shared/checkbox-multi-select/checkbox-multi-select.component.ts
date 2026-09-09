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
import { FormsModule } from '@angular/forms';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  CheckboxMultiSelectAnimationConfig,
  CheckboxMultiSelectGroup,
  CheckboxMultiSelectOption,
  CheckboxMultiSelectResponsiveConfig,
  CheckboxMultiSelectSource,
  CheckboxMultiSelectVariant,
} from './checkbox-multi-select.types';
import {
  flattenOptions,
  isGroupedSource,
  overflowBadges,
  resolveResponsive,
  selectAllValues,
  toVisibleGroups,
  toggleValue,
} from './checkbox-multi-select.util';

@Component({
  selector: 'app-checkbox-multi-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkbox-multi-select.component.html',
  styleUrl: './checkbox-multi-select.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxMultiSelectComponent),
      multi: true,
    },
  ],
})
export class CheckboxMultiSelectComponent implements ControlValueAccessor, OnChanges {
  @Input() options: CheckboxMultiSelectSource = [];
  @Input() value: readonly string[] = [];
  @Input() defaultValue: readonly string[] = [];
  @Input() label = '';
  @Input() labelIcon = '';
  @Input() hint = '';
  @Input() required = false;
  @Input() placeholder = 'Seleccionar opciones';
  @Input() searchPlaceholder = 'Buscar opciones…';
  @Input() emptyMessage = 'Sin coincidencias';
  @Input() selectAllLabel = 'Seleccionar todo';
  @Input() variant: CheckboxMultiSelectVariant = 'default';
  @Input() animation = 0;
  @Input() animationConfig: CheckboxMultiSelectAnimationConfig = {
    badgeAnimation: 'fade',
    popoverAnimation: 'slide',
    optionHoverAnimation: 'highlight',
    duration: 0.2,
  };
  @Input() maxCount = 3;
  @Input() modalPopover = false;
  @Input() hideSelectAll = false;
  @Input() searchable = true;
  @Input() autoSize = false;
  @Input() singleLine = false;
  @Input() disabled = false;
  @Input() responsive: boolean | CheckboxMultiSelectResponsiveConfig = false;
  @Input() minWidth = '';
  @Input() maxWidth = '';
  @Input() deduplicateOptions = false;
  @Input() resetOnDefaultValueChange = true;
  @Input() closeOnSelect = false;
  @Input() clearable = true;
  @Input() popoverClass = '';

  @Output() valueChange = new EventEmitter<string[]>();

  @ViewChild('triggerEl') triggerEl?: ElementRef<HTMLElement>;
  @ViewChild('searchEl') searchEl?: ElementRef<HTMLInputElement>;

  open = false;
  query = '';
  highlightedIndex = 0;
  liveMessage = '';
  viewportWidth =
    typeof window === 'undefined' ? 1280 : window.innerWidth;

  readonly uid = Math.random().toString(36).slice(2, 9);
  readonly labelId = `cms-label-${this.uid}`;
  readonly listboxId = `cms-list-${this.uid}`;

  private onChange: (v: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['defaultValue'] &&
      this.resetOnDefaultValueChange &&
      !changes['defaultValue'].firstChange
    ) {
      this.reset();
    }
  }

  get flatOptions(): CheckboxMultiSelectOption[] {
    return flattenOptions(this.options, this.deduplicateOptions);
  }

  get visibleGroups(): CheckboxMultiSelectGroup[] {
    let source = this.options;
    if (this.deduplicateOptions && isGroupedSource(this.options)) {
      const seen = new Set<string>();
      source = this.options.map((group) => ({
        heading: group.heading,
        options: group.options.filter((option) => {
          if (seen.has(option.value)) return false;
          seen.add(option.value);
          return true;
        }),
      }));
    } else if (this.deduplicateOptions) {
      source = this.flatOptions;
    }
    return toVisibleGroups(source, this.query);
  }

  get visibleOptions(): CheckboxMultiSelectOption[] {
    return this.visibleGroups.flatMap((group) => [...group.options]);
  }

  get selectedOptions(): CheckboxMultiSelectOption[] {
    const map = new Map(this.flatOptions.map((option) => [option.value, option]));
    return this.value.map(
      (id) => map.get(id) ?? { value: id, label: id }
    );
  }

  get layout(): { maxCount: number; compactMode: boolean } {
    return resolveResponsive(this.viewportWidth, this.responsive, this.maxCount);
  }

  get compactMode(): boolean {
    return this.layout.compactMode;
  }

  get visibleBadges(): CheckboxMultiSelectOption[] {
    return overflowBadges(this.selectedOptions, this.layout.maxCount).visible;
  }

  get extraCount(): number {
    return overflowBadges(this.selectedOptions, this.layout.maxCount).extra;
  }

  get showClear(): boolean {
    return this.clearable && !this.disabled && this.value.length > 0;
  }

  get allVisibleSelected(): boolean {
    const enabled = this.visibleOptions.filter((option) => !option.disabled);
    return enabled.length > 0 && enabled.every((option) => this.value.includes(option.value));
  }

  get animMs(): string {
    const seconds = this.animationConfig.duration ?? this.animation ?? 0.2;
    return `${Math.max(0, seconds) * 1000}ms`;
  }

  get hostClasses(): Record<string, boolean> {
    return {
      [`cms--${this.variant}`]: true,
      'cms--disabled': this.disabled,
      'cms--open': this.open,
      'cms--compact': this.compactMode,
      'cms--autosize': this.autoSize,
      'cms--single': this.singleLine,
    };
  }

  isSelected(value: string): boolean {
    return this.value.includes(value);
  }

  badgeStyle(option: CheckboxMultiSelectOption): Record<string, string> {
    const style: Record<string, string> = {};
    if (option.style?.gradient) {
      style['background'] = option.style.gradient;
      style['border-left-color'] = 'transparent';
      style['color'] = '#fff';
    } else if (option.style?.badgeColor) {
      style['background'] = option.style.badgeColor;
      style['border-left-color'] = option.style.badgeColor;
      style['color'] = '#0f172a';
    }
    if (option.style?.iconColor) {
      style['--cms-icon'] = option.style.iconColor;
    }
    return style;
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

  openPopover(): void {
    if (this.disabled) return;
    this.open = true;
    this.highlightedIndex = 0;
    this.onTouched();
    queueMicrotask(() => this.searchEl?.nativeElement.focus());
  }

  closePopover(): void {
    this.open = false;
    this.query = '';
    this.highlightedIndex = 0;
  }

  togglePopover(): void {
    if (this.open) this.closePopover();
    else this.openPopover();
  }

  onTriggerClick(event: MouseEvent): void {
    if (this.disabled) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) return;
    this.togglePopover();
  }

  onSearchChange(query: string): void {
    this.query = query;
    this.highlightedIndex = 0;
  }

  toggleOption(option: CheckboxMultiSelectOption): void {
    if (this.disabled || option.disabled) return;
    const next = toggleValue(this.value, option);
    const added = next.includes(option.value);
    this.emit(next, `${option.label} ${added ? 'seleccionado' : 'quitado'}`);
    if (this.closeOnSelect) this.closePopover();
  }

  toggleSelectAll(): void {
    if (this.disabled) return;
    const next = selectAllValues(this.visibleOptions, this.value);
    this.emit(next, `${next.length} seleccionados`);
  }

  removeValue(value: string, event?: Event): void {
    event?.stopPropagation();
    if (this.disabled || !this.clearable) return;
    const option = this.selectedOptions.find((item) => item.value === value);
    this.emit(
      this.value.filter((id) => id !== value),
      `${option?.label ?? value} quitado`
    );
  }

  clear(event?: Event): void {
    event?.stopPropagation();
    if (this.disabled || !this.clearable) return;
    this.emit([], 'Selección vacía');
  }

  reset(): void {
    this.emit([...this.defaultValue], 'Selección restablecida');
  }

  focus(): void {
    this.triggerEl?.nativeElement.focus();
  }

  getSelectedValues(): string[] {
    return [...this.value];
  }

  setSelectedValues(values: readonly string[]): void {
    this.emit([...values]);
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled) return;
    if (event.key === 'Escape') {
      this.closePopover();
      return;
    }
    if (event.key === 'Backspace' && !this.query && this.value.length) {
      this.removeValue(this.value[this.value.length - 1]);
      return;
    }
    if (['Enter', ' ', 'ArrowDown'].includes(event.key) && !this.open) {
      event.preventDefault();
      this.openPopover();
      return;
    }
    if (!this.open) return;
    this.onListKeydown(event);
  }

  onListKeydown(event: KeyboardEvent): void {
    const list = this.visibleOptions;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closePopover();
      this.focus();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedIndex = Math.min(this.highlightedIndex + 1, Math.max(0, list.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && list[this.highlightedIndex]) {
      event.preventDefault();
      this.toggleOption(list[this.highlightedIndex]);
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && !this.hideSelectAll) {
      event.preventDefault();
      this.toggleSelectAll();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.open) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closePopover();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.viewportWidth = window.innerWidth;
  }

  private emit(next: string[], announcement = ''): void {
    this.value = next;
    this.valueChange.emit(next);
    this.onChange(next);
    if (announcement) this.liveMessage = announcement;
  }
}
