/**
 * tokens.ts — typed accessors for the design tokens declared in `theme.css`.
 *
 * These are deliberately `var(--…)` REFERENCES rather than copies of the hex
 * values, so `theme.css` stays the single source of truth and no value can
 * drift between the CSS and the TS. They are valid anywhere CSS is consumed:
 * inline `style` props, SVG `fill`/`stroke` attributes, and the colour props of
 * chart libraries that forward to those attributes.
 *
 * Use Tailwind utility classes in TSX. Reach for this module only where a
 * class name will not do — i.e. charts and inline styles.
 */

const cssVar = (name: string) => `var(--${name})`

/** Fixed-order categorical palette for data series. Assign by index, never cycle. */
export const seriesPalette = [
  cssVar('color-series-1'),
  cssVar('color-series-2'),
  cssVar('color-series-3'),
  cssVar('color-series-4'),
  cssVar('color-series-5'),
  cssVar('color-series-6'),
  cssVar('color-series-7'),
  cssVar('color-series-8'),
] as const

/**
 * Colour for series slot `index` (0-based).
 *
 * Past slot 8 there is no ninth hue by design: fold the remainder into an
 * "Other" bucket, facet into small multiples, or add a second encoding
 * channel. A generated hue would break the CVD guarantees of the ramp.
 */
export function seriesColor(index: number): string {
  return seriesPalette[index % seriesPalette.length]
}

/** Reserved state colours. Never reuse one of these as a series colour. */
export const statusColors = {
  good: cssVar('color-status-good'),
  warning: cssVar('color-status-warning'),
  critical: cssVar('color-status-critical'),
  neutral: cssVar('color-status-neutral'),
} as const

export const chartColors = {
  grid: cssVar('color-chart-grid'),
  axis: cssVar('color-chart-axis'),
  surface: cssVar('color-surface-card'),
  inkPrimary: cssVar('color-ink-primary'),
  inkSecondary: cssVar('color-ink-secondary'),
  inkMuted: cssVar('color-ink-muted'),
} as const

export const gradients = {
  brand: cssVar('gradient-brand'),
  brandSoft: cssVar('gradient-brand-soft'),
  accentRule: cssVar('gradient-accent-rule'),
  pageWash: cssVar('gradient-page-wash'),
} as const

export type StatusTone = keyof typeof statusColors
