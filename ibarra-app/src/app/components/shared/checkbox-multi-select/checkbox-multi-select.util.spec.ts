import {
  CheckboxMultiSelectGroup,
  CheckboxMultiSelectOption,
} from './checkbox-multi-select.types';
import {
  dedupeOptions,
  filterOptions,
  flattenOptions,
  isGroupedSource,
  overflowBadges,
  resolveResponsive,
  selectAllValues,
  toVisibleGroups,
  toggleValue,
} from './checkbox-multi-select.util';

const react: CheckboxMultiSelectOption = {
  value: 'react',
  label: 'React',
  icon: 'fas fa-bolt',
};
const vue: CheckboxMultiSelectOption = { value: 'vue', label: 'Vue.js' };
const angular: CheckboxMultiSelectOption = {
  value: 'angular',
  label: 'Angular',
  disabled: true,
};
const node: CheckboxMultiSelectOption = { value: 'node', label: 'Node.js' };

const groups: CheckboxMultiSelectGroup[] = [
  { heading: 'Frontend', options: [react, vue, angular] },
  { heading: 'Backend', options: [node] },
];

describe('checkbox-multi-select.util', () => {
  it('detects grouped sources by heading + options', () => {
    expect(isGroupedSource(groups)).toBeTrue();
    expect(isGroupedSource([react, vue])).toBeFalse();
    expect(isGroupedSource([])).toBeFalse();
  });

  it('flattens groups and optionally drops duplicate values', () => {
    const flat = flattenOptions(groups);
    expect(flat.map((o) => o.value)).toEqual(['react', 'vue', 'angular', 'node']);

    const dupes: CheckboxMultiSelectOption[] = [
      react,
      { ...react, label: 'React copy' },
      vue,
    ];
    expect(flattenOptions(dupes, true).map((o) => o.label)).toEqual(['React', 'Vue.js']);
  });

  it('keeps the first occurrence when deduping', () => {
    const first = { value: 'a', label: 'First' };
    const second = { value: 'a', label: 'Second' };
    expect(dedupeOptions([first, second])).toEqual([first]);
  });

  it('filters by label or value, case-insensitive', () => {
    expect(filterOptions([react, vue, node], 'RE')).toEqual([react]);
    expect(filterOptions([react, vue, node], 'node')).toEqual([node]);
    expect(filterOptions([react, vue], '  ')).toEqual([react, vue]);
  });

  it('drops empty groups after search', () => {
    const visible = toVisibleGroups(groups, 'node');
    expect(visible).toEqual([{ heading: 'Backend', options: [node] }]);
  });

  it('wraps a flat list as a single untitled group', () => {
    expect(toVisibleGroups([react, vue], '')).toEqual([
      { heading: '', options: [react, vue] },
    ]);
  });

  it('toggles a value and ignores disabled options', () => {
    expect(toggleValue(['react'], vue)).toEqual(['react', 'vue']);
    expect(toggleValue(['react', 'vue'], vue)).toEqual(['react']);
    expect(toggleValue(['react'], angular)).toEqual(['react']);
  });

  it('select-all picks enabled options and deselects when already complete', () => {
    const all = [react, vue, angular, node];
    expect(selectAllValues(all, [])).toEqual(['react', 'vue', 'node']);
    expect(selectAllValues(all, ['react', 'vue', 'node'])).toEqual([]);
    expect(selectAllValues(all, ['react', 'vue', 'node', 'angular'])).toEqual(['angular']);
  });

  it('caps visible badges and reports overflow', () => {
    const selected = [react, vue, angular, node];
    expect(overflowBadges(selected, 2)).toEqual({
      visible: [react, vue],
      extra: 2,
    });
    expect(overflowBadges(selected, 0).visible.length).toBe(0);
  });

  it('resolves responsive maxCount and compact mode by width', () => {
    expect(resolveResponsive(360, true, 3)).toEqual({ maxCount: 2, compactMode: true });
    expect(resolveResponsive(800, true, 3)).toEqual({ maxCount: 4, compactMode: false });
    expect(resolveResponsive(1400, true, 3)).toEqual({ maxCount: 6, compactMode: false });
    expect(resolveResponsive(1400, false, 3)).toEqual({ maxCount: 3, compactMode: false });
    expect(
      resolveResponsive(360, { mobile: { maxCount: 1, compactMode: true } }, 3)
    ).toEqual({ maxCount: 1, compactMode: true });
  });
});
