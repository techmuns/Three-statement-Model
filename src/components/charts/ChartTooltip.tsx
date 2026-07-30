import type { TooltipContentProps } from 'recharts'
import { cn } from '@/lib/cn'

export interface TooltipRow {
  key: string
  label: string
  /** Series colour for the swatch. Text never wears it. */
  color: string
  value: string
}

/**
 * Shared tooltip surface.
 *
 * Identity comes from a colour swatch beside the label; the label and value
 * themselves stay in ink tokens, so a low-contrast series slot is never
 * rendered as text.
 */
export function ChartTooltipCard({
  title,
  rows,
  className,
}: {
  title: string
  rows: readonly TooltipRow[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-control border border-line-hairline bg-surface-overlay px-3 py-2 shadow-overlay',
        className,
      )}
    >
      <p className="text-caption font-semibold text-ink-primary">{title}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-caption">
            <span
              aria-hidden="true"
              style={{ backgroundColor: row.color }}
              className="size-2 shrink-0 rounded-[2px] ring-1 ring-inset ring-black/10"
            />
            <span className="text-ink-muted">{row.label}</span>
            <span className="tabular ml-auto font-semibold text-ink-primary">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Recharts' own tooltip-content props, at its default generics.
 *
 * Narrowing the generics to `<number, string>` here looks tidier but makes the
 * function unassignable to `Tooltip`'s `content` prop, which is invariant in
 * them — so values arrive widened and `payloadValue` does the narrowing.
 */
export type ChartTooltipProps = TooltipContentProps

/** Reads a numeric datum off a tooltip payload entry by key. */
export function payloadValue(props: ChartTooltipProps, dataKey: string): number | null {
  const entry = props.payload?.find((item) => item.dataKey === dataKey)
  return typeof entry?.value === 'number' ? entry.value : null
}
