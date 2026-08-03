---
name: Precision Utility System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#434655'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#943700'
  on-tertiary: '#ffffff'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  border-low-contrast: '#E2E8F0'
  text-high-contrast: '#0F172A'
  bg-canvas: '#FFFFFF'
  status-error: '#EF4444'
  status-warning: '#F59E0B'
  status-success: '#10B981'
  status-info: '#3B82F6'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  code-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  baseline: 4px
  container-max-width: 1200px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  wizard-step-gap: 12px
---

## Brand & Style

This design system is built for high-stakes professional environments where clarity and data integrity are paramount. It adopts a **Minimalist / Notion-like** aesthetic that prioritizes content over "chrome," ensuring that complex multi-step workflows feel manageable and calm.

The personality is **Professional, Calm, and Efficient**. By utilizing generous white space and a restrained color palette, the interface reduces cognitive load, allowing users to focus on data validation and transformation logic. The style is strictly flat with very subtle tonal layering to indicate hierarchy, avoiding heavy shadows or decorative flourishes that could distract from the utilitarian purpose of the tool.

## Colors

The palette is anchored in **Crisp Whites** and **Soft Grays** to create a clean, laboratory-like environment for data processing. 

- **Primary Accent:** A calm, professional Blue (`#2563EB`) is used sparingly for primary actions, active stepper states, and critical focus points.
- **Structural Borders:** We use a low-contrast gray (`#E2E8F0`) for all dividers and card outlines to maintain a light, airy feel without fragmenting the layout.
- **Typography:** Text uses a high-contrast Slate (`#0F172A`) to ensure maximum readability against the white background.
- **Semantic Feedback:** Colors for error, warning, and success are slightly desaturated to fit the professional tone while remaining distinct for rapid data validation.

## Typography

We use **Inter** for its exceptional legibility in data-heavy interfaces and its neutral, systematic character.

- **Scale:** The hierarchy is tight. Large headings are reserved for page titles, while most interface elements live within the 13px to 16px range.
- **Weights:** Bold (700) is used exclusively for primary titles. Semi-bold (600) is utilized for labels and section headers to provide structure without visual bulk.
- **Data Display:** For technical IDs and file names, use the `code-sm` style, which utilizes a slightly tighter tracking to distinguish technical strings from natural language prose.

## Layout & Spacing

The system employs a **Fixed Grid** philosophy for the main content area to ensure that tables and data forms remain readable on large monitors without stretching awkwardly.

- **The Wizard Layout:** A central 12-column grid is used for the primary workflow. The wizard steps are positioned either in a left-hand sidebar (fixed) or a top-pinned horizontal bar.
- **Whitespace:** Use generous padding (32px - 48px) between major sections to reinforce the "Notion-like" clarity. 
- **Rhythm:** All spacing is derived from a 4px baseline. Components should generally use 16px or 24px internal padding.

## Elevation & Depth

This design system eschews traditional shadows in favor of **Tonal Layers** and **Low-Contrast Outlines**.

- **Surface Levels:** 
  - **Level 0 (Canvas):** Pure white background (`#FFFFFF`).
  - **Level 1 (Cards/Containers):** Outlined with a 1px border (`#E2E8F0`). No fill change or very subtle off-white (`#F8FAFC`).
  - **Level 2 (Active/Hover):** A very soft, diffused shadow (0px 2px 4px rgba(0,0,0,0.05)) is permissible only on interactive elements like buttons or active cards.
- **Interactive States:** Use subtle background shifts (e.g., White to #F1F5F9) instead of elevation changes to indicate hover states.

## Shapes

The shape language is **Soft (Level 1)**. 

Elements use a 0.25rem (4px) corner radius to feel precise and professional. This subtle rounding maintains the "utility" feel while removing the harshness of sharp 90-degree corners. Larger containers like Dashboard Cards may use up to 0.5rem (8px) to distinguish them from smaller inputs or buttons.

## Components

- **Bordered Cards:** Use a 1px solid border (`#E2E8F0`) with 24px padding. Titles inside cards should be `label-md` in uppercase or `headline-md` depending on the section hierarchy.
- **Stepper:** A vertical or horizontal linear indicator. Completed steps use a small success checkmark; the active step uses a primary blue outline; pending steps use a muted gray.
- **Buttons:** 
  - *Primary:* Solid blue background, white text. 
  - *Secondary:* White background, gray border, slate text. 
  - *Ghost:* No border or background, slate text; used for "Back" or "Cancel".
- **Inputs:** Simple 1px borders. Focus state should be a subtle 1px blue ring with no outer glow.
- **Breadcrumbs:** Simple text links separated by a `/` or `>` in a light gray. 
- **Drop Zones:** For file uploads, use a dashed border (`#CBD5E1`) with a soft gray background fill (`#F8FAFC`) to indicate interactivity.
- **Data Tables:** Row-based with 1px horizontal dividers. Header cells should have a light gray background (`#F1F5F9`) and use `label-md` typography.