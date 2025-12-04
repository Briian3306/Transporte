import { Component, Input, Output, EventEmitter, forwardRef, OnInit, OnDestroy, OnChanges, SimpleChanges, ElementRef, ViewChild, HostListener } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Insumo } from '../../models/chofer.model';

@Component({
  selector: 'app-autocomplete-insumo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './autocomplete-insumo.component.html',
  styleUrl: './autocomplete-insumo.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutocompleteInsumoComponent),
      multi: true
    }
  ]
})
export class AutocompleteInsumoComponent implements ControlValueAccessor, OnInit, OnDestroy, OnChanges {
  @Input() insumos: Insumo[] = [];
  @Input() placeholder: string = 'Buscar insumo...';
  @Input() label: string = '';
  @Input() required: boolean = false;
  @Input() error: boolean = false;
  @Input() errorMessage: string = '';
  @Input() showStock: boolean = false;
  @Input() getStockCallback?: (insumoId: number) => number;
  @Input() disabled: boolean = false;

  @Output() selected = new EventEmitter<Insumo | null>();

  @ViewChild('inputRef', { static: false }) inputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('dropdownRef', { static: false }) dropdownRef!: ElementRef<HTMLDivElement>;

  searchText: string = '';
  filteredInsumos: Insumo[] = [];
  isOpen: boolean = false;
  selectedInsumo: Insumo | null = null;
  highlightedIndex: number = -1;

  private onChange = (value: any) => {};
  private onTouched = () => {};

  ngOnInit(): void {
    this.filteredInsumos = this.insumos;
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Actualizar lista filtrada cuando cambian los insumos
    if (changes['insumos'] && this.insumos) {
      this.filteredInsumos = this.insumos;
      // Si hay un insumo seleccionado, verificar que aún existe en la lista
      if (this.selectedInsumo) {
        const existe = this.insumos.find(i => i.id === this.selectedInsumo?.id);
        if (!existe) {
          this.clearSelection();
        } else {
          // Actualizar el texto de búsqueda si el insumo cambió
          this.searchText = this.selectedInsumo.nombre;
        }
      }
    }
  }

  ngOnDestroy(): void {
    // Cleanup si es necesario
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.inputRef && this.dropdownRef) {
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
    this.filterInsumos();
  }

  onInputBlur(): void {
    // Delay para permitir que el click en el dropdown se procese
    setTimeout(() => {
      if (!this.dropdownRef?.nativeElement.contains(document.activeElement)) {
        this.closeDropdown();
      }
    }, 200);
  }

  onInputChange(): void {
    this.filterInsumos();
    this.isOpen = true;
    this.highlightedIndex = -1;
    
    // Si el usuario borra todo el texto y había un insumo seleccionado, limpiar la selección
    if (!this.searchText.trim() && this.selectedInsumo) {
      this.clearSelection();
    } else if (this.searchText.trim() && this.selectedInsumo) {
      // Si el usuario cambia el texto y hay un insumo seleccionado, verificar si coincide
      if (this.searchText !== this.selectedInsumo.nombre) {
        // El texto no coincide con el insumo seleccionado, limpiar selección
        this.selectedInsumo = null;
        this.onChange('');
        this.selected.emit(null);
      }
    }
  }

  filterInsumos(): void {
    const search = this.searchText.toLowerCase().trim();
    if (!search) {
      this.filteredInsumos = this.insumos;
    } else {
      this.filteredInsumos = this.insumos.filter(insumo =>
        insumo.nombre.toLowerCase().includes(search) ||
        insumo.codigo?.toLowerCase().includes(search) ||
        insumo.categoria.nombre.toLowerCase().includes(search)
      );
    }
  }

  selectInsumo(insumo: Insumo): void {
    this.selectedInsumo = insumo;
    this.searchText = insumo.nombre;
    this.onChange(insumo.id.toString());
    this.onTouched();
    this.selected.emit(insumo);
    this.closeDropdown();
  }

  clearSelection(): void {
    this.selectedInsumo = null;
    this.searchText = '';
    this.onChange('');
    this.onTouched();
    this.selected.emit(null);
    this.filteredInsumos = this.insumos;
    this.closeDropdown();
  }

  closeDropdown(): void {
    this.isOpen = false;
    this.highlightedIndex = -1;
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.isOpen || this.filteredInsumos.length === 0) {
      if (event.key === 'Enter' || event.key === 'ArrowDown') {
        this.isOpen = true;
        this.filterInsumos();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedIndex = Math.min(
          this.highlightedIndex + 1,
          this.filteredInsumos.length - 1
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
        if (this.highlightedIndex >= 0 && this.highlightedIndex < this.filteredInsumos.length) {
          this.selectInsumo(this.filteredInsumos[this.highlightedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.closeDropdown();
        break;
    }
  }

  scrollToHighlighted(): void {
    if (this.dropdownRef && this.highlightedIndex >= 0) {
      const items = this.dropdownRef.nativeElement.querySelectorAll('.dropdown-item');
      if (items[this.highlightedIndex]) {
        items[this.highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }

  getStock(insumoId: number): number {
    if (this.getStockCallback) {
      return this.getStockCallback(insumoId);
    }
    return 0;
  }

  // ControlValueAccessor implementation
  writeValue(value: any): void {
    if (value && value !== '' && value !== null) {
      const insumo = this.insumos.find(i => i.id.toString() === value.toString());
      if (insumo) {
        this.selectedInsumo = insumo;
        this.searchText = insumo.nombre;
      } else {
        // Si no se encuentra el insumo, limpiar
        this.selectedInsumo = null;
        this.searchText = '';
      }
    } else {
      this.selectedInsumo = null;
      this.searchText = '';
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}

