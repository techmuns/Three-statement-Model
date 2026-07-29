import type { ReactNode } from 'react'

export interface WidgetEmptyStateProps {
  /** The headline — say what is missing, not "no data". */
  message: string
  /** One line on what would fill it. */
  hint?: string
  /** Optional call to action, e.g. a "Choose a company" button. */
  action?: ReactNode
}

/**
 * Empty state for a widget body. Centred, with a minimum height so a card in
 * this state keeps roughly the footprint it will have when populated.
 */
export function WidgetEmptyState({ message, hint, action }: WidgetEmptyStateProps) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
      <span
        aria-hidden="true"
        className="mb-1 flex size-9 items-center justify-center rounded-full bg-gradient-brand-soft ring-1 ring-brand-100"
      >
        <svg viewBox="0 0 20 20" className="size-4 text-brand-600" fill="currentColor">
          <path d="M3 15.5a1 1 0 0 0 1 1h12a1 1 0 1 0 0-2H5V4a1 1 0 0 0-2 0v11.5Z" />
          <path
            d="M7.5 12.5v-3m3 3v-6m3 6v-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </span>
      <p className="text-title font-semibold text-ink-secondary">{message}</p>
      {hint && <p className="max-w-xs text-caption text-ink-subtle">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
