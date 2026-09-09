export type CheckboxMultiSelectVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'inverted';

export type CheckboxMultiSelectBadgeAnimation =
  | 'none'
  | 'bounce'
  | 'pulse'
  | 'wiggle'
  | 'fade'
  | 'slide';

export type CheckboxMultiSelectPopoverAnimation =
  | 'none'
  | 'scale'
  | 'slide'
  | 'fade'
  | 'flip';

export type CheckboxMultiSelectHoverAnimation =
  | 'none'
  | 'highlight'
  | 'scale'
  | 'glow';

export interface CheckboxMultiSelectAnimationConfig {
  badgeAnimation?: CheckboxMultiSelectBadgeAnimation;
  popoverAnimation?: CheckboxMultiSelectPopoverAnimation;
  optionHoverAnimation?: CheckboxMultiSelectHoverAnimation;
  duration?: number;
  delay?: number;
}

export interface CheckboxMultiSelectOptionStyle {
  badgeColor?: string;
  iconColor?: string;
  gradient?: string;
}

export interface CheckboxMultiSelectOption {
  label: string;
  value: string;
  /** Font Awesome class, e.g. `fas fa-truck`. */
  icon?: string;
  disabled?: boolean;
  style?: CheckboxMultiSelectOptionStyle;
}

export interface CheckboxMultiSelectGroup {
  heading: string;
  options: readonly CheckboxMultiSelectOption[];
}

export type CheckboxMultiSelectSource =
  | readonly CheckboxMultiSelectOption[]
  | readonly CheckboxMultiSelectGroup[];

export interface CheckboxMultiSelectBreakpointConfig {
  maxCount?: number;
  compactMode?: boolean;
}

export interface CheckboxMultiSelectResponsiveConfig {
  mobile?: CheckboxMultiSelectBreakpointConfig;
  tablet?: CheckboxMultiSelectBreakpointConfig;
  desktop?: CheckboxMultiSelectBreakpointConfig;
}

export const CHECKBOX_MULTI_SELECT_DEFAULT_RESPONSIVE: Required<CheckboxMultiSelectResponsiveConfig> =
  {
    mobile: { maxCount: 2, compactMode: true },
    tablet: { maxCount: 4, compactMode: false },
    desktop: { maxCount: 6, compactMode: false },
  };
