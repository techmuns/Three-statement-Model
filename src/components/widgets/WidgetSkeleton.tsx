import { cn } from '@/lib/cn'

/**
 * A single shimmering placeholder block. Purely decorative — the
 * announcement is made once by the container, not per block.
 */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('shimmer rounded-md', className)} />
}

export interface WidgetSkeletonProps {
  /** Number of stat rows to mimic. Match the widget's real row count so the
   * card does not resize when data arrives. */
  rows?: number
  /** Announced to assistive tech while the widget loads. */
  label?: string
}

/**
 * Loading state for a widget body. Mirrors the geometry of `StatTile` rows so
 * the swap to real content does not shift the layout.
 */
export function WidgetSkeleton({ rows = 2, label = 'Loading' }: WidgetSkeletonProps) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="h-6 w-40" />
          <SkeletonBlock className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}
