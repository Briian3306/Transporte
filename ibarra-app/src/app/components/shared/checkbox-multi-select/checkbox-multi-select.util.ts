import {
  CHECKBOX_MULTI_SELECT_DEFAULT_RESPONSIVE,
  CheckboxMultiSelectGroup,
  CheckboxMultiSelectOption,
  CheckboxMultiSelectResponsiveConfig,
  CheckboxMultiSelectSource,
} from './checkbox-multi-select.types';

export function isGroupedSource(
  source: CheckboxMultiSelectSource
): source is readonly CheckboxMultiSelectGroup[] {
  const first = source[0];
  return !!first && 'heading' in first && 'options' in first;
}

export function flattenOptions(
  source: CheckboxMultiSelectSource,
  dedupe = false
): CheckboxMultiSelectOption[] {
  const flat = isGroupedSource(source)
    ? source.flatMap((group) => [...group.options])
    : [...source];
  return dedupe ? dedupeOptions(flat) : flat;
}

export function dedupeOptions(
  options: readonly CheckboxMultiSelectOption[]
): CheckboxMultiSelectOption[] {
  const seen = new Set<string>();
  const out: CheckboxMultiSelectOption[] = [];
  for (const option of options) {
    if (seen.has(option.value)) continue;
    seen.add(option.value);
    out.push(option);
  }
  return out;
}

export function filterOptions(
  options: readonly CheckboxMultiSelectOption[],
  query: string
): CheckboxMultiSelectOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...options];
  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q)
  );
}

export function toVisibleGroups(
  source: CheckboxMultiSelectSource,
  query: string
): CheckboxMultiSelectGroup[] {
  if (isGroupedSource(source)) {
    return source
      .map((group) => ({
        heading: group.heading,
        options: filterOptions(group.options, query),
      }))
      .filter((group) => group.options.length > 0);
  }
  return [{ heading: '', options: filterOptions(source, query) }];
}

export function toggleValue(
  selected: readonly string[],
  option: CheckboxMultiSelectOption
): string[] {
  if (option.disabled) return [...selected];
  if (selected.includes(option.value)) {
    return selected.filter((value) => value !== option.value);
  }
  return [...selected, option.value];
}

export function selectAllValues(
  options: readonly CheckboxMultiSelectOption[],
  selected: readonly string[]
): string[] {
  const enabled = options.filter((option) => !option.disabled).map((option) => option.value);
  const selectedSet = new Set(selected);
  const allEnabledSelected = enabled.every((value) => selectedSet.has(value));
  if (allEnabledSelected) {
    return selected.filter((value) => !enabled.includes(value));
  }
  const next = new Set(selected);
  for (const value of enabled) next.add(value);
  return [...next];
}

export function overflowBadges(
  selected: readonly CheckboxMultiSelectOption[],
  maxCount: number
): { visible: CheckboxMultiSelectOption[]; extra: number } {
  const cap = Math.max(0, maxCount);
  return {
    visible: selected.slice(0, cap),
    extra: Math.max(0, selected.length - cap),
  };
}

export function resolveResponsive(
  width: number,
  responsive: boolean | CheckboxMultiSelectResponsiveConfig,
  fallbackMaxCount: number
): { maxCount: number; compactMode: boolean } {
  if (!responsive) {
    return { maxCount: fallbackMaxCount, compactMode: false };
  }

  const defaults = CHECKBOX_MULTI_SELECT_DEFAULT_RESPONSIVE;
  const custom = responsive === true ? {} : responsive;
  const bucket =
    width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
  const merged = { ...defaults[bucket], ...custom[bucket] };

  return {
    maxCount: merged.maxCount ?? fallbackMaxCount,
    compactMode: merged.compactMode ?? false,
  };
}
