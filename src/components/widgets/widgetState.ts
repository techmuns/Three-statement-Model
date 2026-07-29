import type { NavItem } from '@/config/navigation'

/**
 * The states a widget body can be in.
 *
 * Present from this phase on, even though the data is static, so that every
 * later phase renders the same three components rather than inventing its own
 * spinner or blank card.
 */
export type WidgetState = 'ready' | 'loading' | 'empty'

export const WIDGET_STATES: readonly NavItem<WidgetState>[] = [
  { id: 'ready', label: 'Ready' },
  { id: 'loading', label: 'Loading' },
  { id: 'empty', label: 'Empty' },
]
