import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchMultiSelectComponent } from './search-multi-select.component';

describe('SearchMultiSelectComponent', () => {
  let fixture: ComponentFixture<SearchMultiSelectComponent>;
  let component: SearchMultiSelectComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchMultiSelectComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SearchMultiSelectComponent);
    component = fixture.componentInstance;
    component.options = [
      { id: '1', label: 'AG676SP' },
      { id: '2', label: 'AD239PP' },
      { id: '3', label: 'XYZ111' },
    ];
    fixture.detectChanges();
  });

  it('shows up to maxResults matches after typing', () => {
    component.maxResults = 2;
    component.onQueryChange('A');
    expect(component.filteredOptions.length).toBe(2);
    expect(component.open).toBeTrue();
  });

  it('selects and removes chip values', () => {
    const emitted: string[][] = [];
    component.valueChange.subscribe((v) => emitted.push(v));
    component.selectOption({ id: '1', label: 'AG676SP' });
    expect(component.value).toEqual(['1']);
    component.removeId('1');
    expect(component.value).toEqual([]);
    expect(emitted.length).toBe(2);
  });

  it('single mode replaces selection', () => {
    component.mode = 'single';
    component.selectOption({ id: '1', label: 'AG676SP' });
    component.selectOption({ id: '2', label: 'AD239PP' });
    expect(component.value).toEqual(['2']);
  });

  it('hides already selected options from dropdown', () => {
    component.value = ['1'];
    component.onQueryChange('AG');
    expect(component.filteredOptions.every((o) => o.id !== '1')).toBeTrue();
  });
});
