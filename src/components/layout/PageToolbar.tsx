import type { ReactNode } from 'react'

/**
 * The control strip that sits above a view's widget grid: the view's title on
 * the left, its controls on the right. Wraps to two rows on narrow screens.
 */
export function PageToolbar({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h2 className="text-heading font-bold tracking-tight text-ink-primary">{title}</h2>
        {description && <p className="mt-0.5 text-caption text-ink-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div>}
    </div>
  )
}
