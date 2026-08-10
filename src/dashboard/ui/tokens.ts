/**
 * Munshot embedded-dashboard design tokens.
 *
 * These mirror the mandatory UI chrome from the Munshot dashboard builder guide
 * (indigo primary + grayscale). They live as plain constants because Munshot
 * dashboards are styled with inline styles, not Tailwind — the host embeds the
 * built dashboard as an iframe and must not depend on our class layer.
 */

export const T = {
  // Chrome
  primary: '#4f46e5',
  primaryLight: '#eef2ff',
  primaryBorder: '#e0e7ff',
  primaryText: '#4338ca',
  primaryDot: '#6366f1',

  // Surfaces
  pageBg: 'linear-gradient(to bottom, rgba(249,250,251,0.8), #ffffff)',
  cardBg: 'rgba(255,255,255,0.9)',
  cardHeaderBg: 'rgba(255,255,255,0.95)',
  cardBodyBg: 'rgba(249,250,251,0.5)',
  headerBar: 'rgba(255,255,255,0.95)',
  borderDefault: 'rgba(229,231,235,0.8)',
  borderHover: 'rgba(79,70,229,0.2)',
  hairline: '#e5e7eb',

  // Text
  ink: '#111827',
  inkSecondary: '#374151',
  inkMuted: '#6b7280',
  inkHint: '#9ca3af',

  // Status
  errorText: '#ef4444',
  errorBg: '#fef2f2',
  good: '#059669',
  goodBg: '#ecfdf5',
  bad: '#dc2626',
  badBg: '#fef2f2',
  warn: '#d97706',
  warnBg: '#fffbeb',
} as const

/** One transition, used everywhere per the guide. */
export const TRANSITION = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)'

export const FONT_STACK = 'system-ui, -apple-system, sans-serif'
