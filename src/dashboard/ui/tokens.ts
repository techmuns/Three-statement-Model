/**
 * Dhamma Capital earnings-dashboard design tokens.
 *
 * A restrained purple identity on a cool grey-lavender page with crisp navy
 * type — purple is the selection/identity colour, not a wash. These live as
 * plain constants because the dashboard is styled with inline styles (it ships
 * as a standalone SPA), so every colour flows from here.
 */

export const T = {
  // Purple identity — controlled selection/accent colour, never a full wash.
  primary: '#5B35F5',
  primaryDark: '#4323C7',
  primaryLight: '#F0EDFF',
  primaryBorder: '#D9D2FF',
  primaryText: '#4B2BE3',
  primaryDot: '#5B35F5',
  /** Soft lavender fill for a selected row / active column. */
  selectedRow: '#F2F0FF',

  // Surfaces
  pageBg: '#F7F8FC',
  cardBg: '#FFFFFF',
  cardHeaderBg: '#FFFFFF',
  cardBodyBg: '#FAFAFE',
  headerBar: '#FFFFFF',
  borderDefault: '#E3E6EF',
  borderHover: '#D9D2FF',
  hairline: '#E3E6EF',
  /** The one card shadow — extremely subtle. */
  cardShadow: '0 2px 8px rgba(31, 38, 62, 0.05)',

  // Text
  ink: '#171B2B',
  inkSecondary: '#344054',
  inkMuted: '#667085',
  inkHint: '#98A2B3',

  // Status — each pairs with its own soft background. Semantic only.
  errorText: '#D92D20',
  errorBg: '#FFF0EF',
  good: '#159455',
  goodBg: '#ECF8F1',
  bad: '#D92D20',
  badBg: '#FFF0EF',
  warn: '#D98A12',
  warnBg: '#FFF7E6',
} as const

/**
 * Categorical palette for the revenue-mix-by-segment chart. Distinct hues (led
 * by the brand purple) so adjacent segments are easy to tell apart — a
 * deliberate exception to the purple-only chart rule, since a segment split
 * needs separable colours, not a single-hue ramp. Assigned largest-share-first.
 */
export const SEGMENT_PALETTE: readonly string[] = [
  '#5B35F5', // brand purple
  '#0D9488', // teal
  '#F59E0B', // amber
  '#2563EB', // blue
  '#DB2777', // magenta
  '#16A34A', // green
  '#EA580C', // orange
  '#0891B2', // cyan
]

/** One transition, used everywhere. */
export const TRANSITION = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)'

export const FONT_STACK =
  "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
