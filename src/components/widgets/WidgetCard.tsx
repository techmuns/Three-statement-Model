import type { ReactNode } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/cn'

export interface WidgetCardProps {
  title: string
  subtitle?: string
  /** Small uppercase tag in the header's trailing corner. */
  badge?: string
  /** Rendered under the body, separated by a hairline. */
  footnote?: string
  /** Spans two columns where the grid has room. */
  wide?: boolean
  children: ReactNode
}

/**
 * The one card shell every widget in the app uses.
 *
 * Renders as a `<section>` labelled by its own heading, so the card is a
 * landmark a screen-reader user can jump between. Content states (loading,
 * empty) are passed in as `children` — the card itself is state-agnostic.
 */
export function WidgetCard({
  title,
  subtitle,
  badge,
  footnote,
  wide = false,
  children,
}: WidgetCardProps) {
  const headingId = useId()

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'group flex flex-col overflow-hidden rounded-card border border-line-hairline',
        'bg-surface-card shadow-card transition-shadow duration-300 ease-[var(--ease-standard)]',
        'hover:shadow-card-hover focus-within:shadow-card-hover',
        // Only from `lg` up, where the auto-fill grid is guaranteed to have
        // at least two tracks for the span to consume.
        wide && 'lg:col-span-2',
      )}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line-hairline px-4 py-3">
        <div className="min-w-0">
          <h3 id={headingId} className="truncate text-title font-semibold text-ink-primary">
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 truncate text-caption text-ink-subtle">{subtitle}</p>}
        </div>
        {badge && (
          <span className="shrink-0 rounded-md border border-brand-100 bg-brand-50 px-2 py-0.5 text-micro font-semibold tracking-wide text-brand-700 uppercase">
            {badge}
          </span>
        )}
      </header>

      <div className="flex-1 bg-surface-sunken/60 p-4">{children}</div>

      {footnote && (
        <p className="shrink-0 border-t border-line-hairline px-4 py-2 text-caption text-ink-subtle">
          {footnote}
        </p>
      )}
    </section>
  )
}
