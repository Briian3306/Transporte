import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchSelectComponent } from './search-select.component';

describe('SearchSelectComponent', () => {
  let fixture: ComponentFixture<SearchSelectComponent>;
  let component: SearchSelectComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchSelectComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SearchSelectComponent);
    component = fixture.componentInstance;
    component.options = [
      { id: 'e1', label: 'Autopistas Urbanas' },
      { id: 'e2', label: 'Acceso Oeste' },
      { id: 'e3', label: 'AUSOL' },
    ];
    fixture.detectChanges();
  });

  it('shows up to maxResults matches after typing', () => {
    component.maxResults = 2;
    component.onQueryChange('A');
    expect(component.filteredOptions.length).toBe(2);
    expect(component.open).toBeTrue();
  });

  it('opens options on focus when blank', () => {
    component.onFocus();
    expect(component.open).toBeTrue();
    expect(component.filteredOptions.length).toBe(3);
  });

  it('lists all options when blank and showAllWhenEmpty', () => {
    component.options = Array.from({ length: 15 }, (_, i) => ({
      id: `p${i}`,
      label: `Plantilla ${i}`,
    }));
    component.maxResults = 10;
    component.showAllWhenEmpty = true;
    component.onFocus();
    expect(component.filteredOptions.length).toBe(15);
  });

  it('selects a single value and replaces previous', () => {
    const emitted: Array<string | null> = [];
    component.valueChange.subscribe((v) => emitted.push(v));
    component.selectOption({ id: 'e1', label: 'Autopistas Urbanas' });
    component.selectOption({ id: 'e2', label: 'Acceso Oeste' });
    expect(component.value).toBe('e2');
    expect(emitted).toEqual(['e1', 'e2']);
  });

  it('clears selection when clearable', () => {
    component.selectOption({ id: 'e1', label: 'Autopistas Urbanas' });
    component.clear();
    expect(component.value).toBeNull();
  });

  it('hides current selection from dropdown results', () => {
    component.value = 'e1';
    component.onQueryChange('Auto');
    expect(component.filteredOptions.every((o) => o.id !== 'e1')).toBeTrue();
  });

  it('implements ControlValueAccessor for string | null', () => {
    let changed: string | null = 'unset' as unknown as string | null;
    component.registerOnChange((v) => {
      changed = v;
    });
    component.writeValue('e3');
    expect(component.value).toBe('e3');
    component.selectOption({ id: 'e2', label: 'Acceso Oeste' });
    expect(changed).toBe('e2');
  });

  it('keeps selected label after keyboard pick while query is cleared', () => {
    component.onQueryChange('Au');
    component.selectOption({ id: 'e1', label: 'Autopistas Urbanas' });
    fixture.detectChanges();
    expect(component.query).toBe('');
    expect(component.selectedOption?.label).toBe('Autopistas Urbanas');
    const valueEl = fixture.nativeElement.querySelector('.ss__value') as HTMLElement | null;
    expect(valueEl?.textContent?.trim()).toBe('Autopistas Urbanas');
  });
});
