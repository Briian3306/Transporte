import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheckboxMultiSelectComponent } from './checkbox-multi-select.component';
import { CheckboxMultiSelectOption } from './checkbox-multi-select.types';

const options: CheckboxMultiSelectOption[] = [
  { value: 'react', label: 'React', icon: 'fas fa-bolt', style: { iconColor: '#61dafb' } },
  { value: 'vue', label: 'Vue.js', icon: 'fas fa-leaf' },
  { value: 'angular', label: 'Angular', disabled: true },
  { value: 'svelte', label: 'Svelte' },
];

describe('CheckboxMultiSelectComponent', () => {
  let fixture: ComponentFixture<CheckboxMultiSelectComponent>;
  let component: CheckboxMultiSelectComponent;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckboxMultiSelectComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CheckboxMultiSelectComponent);
    component = fixture.componentInstance;
    component.options = options;
    component.label = 'Frameworks';
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  });

  it('opens the popover from the trigger and lists checkboxes', () => {
    expect(root.querySelector('[role="listbox"]')).toBeNull();
    root.querySelector<HTMLButtonElement>('.cms__trigger')?.click();
    fixture.detectChanges();
    expect(root.querySelector('[role="listbox"]')).toBeTruthy();
    expect(root.querySelectorAll('[role="option"]').length).toBe(4);
  });

  it('toggles an option and emits the selected values', () => {
    const emitted: string[][] = [];
    component.valueChange.subscribe((v) => emitted.push(v));
    component.toggleOption(options[0]);
    expect(component.value).toEqual(['react']);
    component.toggleOption(options[1]);
    expect(component.value).toEqual(['react', 'vue']);
    expect(emitted.at(-1)).toEqual(['react', 'vue']);
  });

  it('does not select a disabled option', () => {
    component.toggleOption(options[2]);
    expect(component.value).toEqual([]);
  });

  it('selects all enabled options and then clears them', () => {
    component.toggleSelectAll();
    expect(component.value).toEqual(['react', 'vue', 'svelte']);
    component.toggleSelectAll();
    expect(component.value).toEqual([]);
  });

  it('filters the list from the popover search', () => {
    component.openPopover();
    component.onSearchChange('ang');
    expect(component.visibleGroups[0].options.map((o) => o.value)).toEqual(['angular']);
  });

  it('removes a badge and clears every selection', () => {
    component.setSelectedValues(['react', 'vue']);
    component.removeValue('react');
    expect(component.value).toEqual(['vue']);
    component.clear();
    expect(component.value).toEqual([]);
  });

  it('caps visible badges and shows an overflow count', () => {
    component.maxCount = 1;
    component.setSelectedValues(['react', 'vue', 'svelte']);
    fixture.detectChanges();
    expect(root.querySelectorAll('.cms__badge').length).toBe(1);
    expect(root.textContent).toContain('+2');
  });

  it('closes on select when closeOnSelect is true', () => {
    component.closeOnSelect = true;
    component.openPopover();
    component.toggleOption(options[0]);
    expect(component.open).toBeFalse();
  });

  it('resets to defaultValue and exposes imperative getters', () => {
    component.defaultValue = ['vue'];
    component.setSelectedValues(['react']);
    expect(component.getSelectedValues()).toEqual(['react']);
    component.reset();
    expect(component.getSelectedValues()).toEqual(['vue']);
  });

  it('applies variant, required marker and helper text', () => {
    component.variant = 'destructive';
    component.required = true;
    component.hint = 'Elegí al menos uno';
    fixture.detectChanges();
    expect(root.querySelector('.cms--destructive')).toBeTruthy();
    expect(root.querySelector('.cms__required')).toBeTruthy();
    expect(root.textContent).toContain('Elegí al menos uno');
  });

  it('deduplicates options when enabled', () => {
    component.deduplicateOptions = true;
    component.options = [
      { value: 'react', label: 'React' },
      { value: 'react', label: 'React dup' },
      { value: 'vue', label: 'Vue.js' },
    ];
    component.openPopover();
    expect(component.flatOptions.map((o) => o.label)).toEqual(['React', 'Vue.js']);
  });

  it('renders group headings', () => {
    component.options = [
      { heading: 'Frontend', options: [options[0], options[1]] },
      { heading: 'Legacy', options: [options[2]] },
    ];
    component.openPopover();
    fixture.detectChanges();
    const headings = Array.from(root.querySelectorAll('.cms__heading')).map((el) =>
      el.textContent?.trim()
    );
    expect(headings).toEqual(['Frontend', 'Legacy']);
  });

  it('writes values through ControlValueAccessor', () => {
    component.writeValue(['svelte']);
    expect(component.value).toEqual(['svelte']);
    component.writeValue(null);
    expect(component.value).toEqual([]);
  });
});
