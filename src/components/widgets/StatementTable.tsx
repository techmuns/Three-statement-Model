import type { Reported } from '@/types/common'
import type { PeriodRef } from '@/types/period'
import { cn } from '@/lib/cn'

export interface StatementTableRow {
  key: string
  label: string
  /** One value per period, in the same order as `periods`. */
  values: readonly Reported<number>[]
  /** Turns a value into display text. Responsible for the not-reported case. */
  format: (value: Reported<number>) => string
  /** Subtotals and the bottom line, rendered heavier with a rule above. */
  emphasis?: boolean
}

/**
 * A statement rendered as line items down, periods across.
 *
 * The table is the accessible twin of this tab's charts: every plotted value
 * appears here as text, so nothing is gated behind a hover. Built to be reused
 * by the balance sheet and cash flow tabs — it knows nothing about which
 * statement it is showing beyond the rows it is handed.
 *
 * Scrolls horizontally inside its own container on narrow screens, with the
 * line-item column pinned, so the page body never scrolls sideways.
 */
export function StatementTable({
  caption,
  periods,
  rows,
}: {
  caption: string
  periods: readonly PeriodRef[]
  rows: readonly StatementTableRow[]
}) {
  return (
    <div className="overflow-x-auto rounded-control border border-line-hairline bg-surface-card">
      <table className="w-full min-w-[36rem] border-collapse text-body">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line-hairline">
            <th
              scope="col"
              className="sticky left-0 z-10 bg-surface-card px-3 py-2 text-left text-caption font-semibold text-ink-muted"
            >
              Line item
            </th>
            {periods.map((period) => (
              <th
                key={period.id}
                scope="col"
                title={period.longLabel}
                className="px-3 py-2 text-right text-caption font-semibold whitespace-nowrap text-ink-muted"
              >
                {period.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={cn(
                'border-t border-line-hairline/70',
                row.emphasis && 'bg-surface-sunken/70',
              )}
            >
              <th
                scope="row"
                className={cn(
                  'sticky left-0 z-10 px-3 py-2 text-left font-normal whitespace-nowrap text-ink-secondary',
                  row.emphasis
                    ? 'bg-surface-sunken font-semibold text-ink-primary'
                    : 'bg-surface-card',
                )}
              >
                {row.label}
              </th>
              {row.values.map((value, index) => (
                <td
                  key={periods[index]?.id ?? index}
                  className={cn(
                    'tabular px-3 py-2 text-right whitespace-nowrap',
                    row.emphasis ? 'font-semibold text-ink-primary' : 'text-ink-secondary',
                  )}
                >
                  {row.format(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
