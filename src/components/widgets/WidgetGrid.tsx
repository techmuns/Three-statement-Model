import type { ReactNode } from 'react'

/**
 * Responsive widget grid. Cards are laid out by available width rather than a
 * fixed column count, so the layout collapses to a single column on narrow
 * screens without a breakpoint per view.
 */
export function WidgetGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]">
      {children}
    </div>
  )
}
