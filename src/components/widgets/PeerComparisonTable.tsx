import { KPI_DEFINITIONS } from '@/config/kpis'
import { cn } from '@/lib/cn'
import { formatKpiValue } from '@/lib/kpiFormat'
import type { PeerComparisonRow } from '@/types/peers'

/**
 * `derived` rows are tracked companies computed from full statements we hold and
 * can be drilled into; `carried` rows are external peers' headline values with
 * no statements behind them, so the badge marks them as not drillable.
 */
function OriginBadge({ origin }: { origin: PeerComparisonRow['origin'] }) {
  const tracked = origin === 'derived'
  return (
    <span
      className={cn(
        'shrink-0 rounded-md border px-1.5 py-0.5 text-micro font-semibold tracking-wide uppercase',
        tracked
          ? 'border-brand-100 bg-brand-50 text-brand-700'
          : 'border-line-hairline bg-surface-sunken text-ink-muted',
      )}
    >
      {tracked ? 'Tracked' : 'Carried'}
    </span>
  )
}

/**
 * The subject company beside its tracked siblings and carried peers, KPIs
 * across. Built to the same conventions as `StatementTable` — sticky first
 * column, hairline rules, the subject row emphasised — but each column is a
 * different KPI with its own unit, so it formats per column rather than per row.
 */
export function PeerComparisonTable({
  rows,
  caption,
}: {
  rows: readonly PeerComparisonRow[]
  caption: string
}) {
  return (
    <div className="overflow-x-auto rounded-control border border-line-hairline bg-surface-card">
      <table className="w-full min-w-[46rem] border-collapse text-body">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line-hairline">
            <th
              scope="col"
              className="sticky left-0 z-10 bg-surface-card px-3 py-2 text-left text-caption font-semibold text-ink-muted"
            >
              Company
            </th>
            {KPI_DEFINITIONS.map((definition) => (
              <th
                key={definition.id}
                scope="col"
                title={definition.label}
                className="px-3 py-2 text-right text-caption font-semibold whitespace-nowrap text-ink-muted"
              >
                {definition.shortLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                'border-t border-line-hairline/70',
                row.isSubject && 'bg-surface-sunken/70',
              )}
            >
              <th
                scope="row"
                className={cn(
                  'sticky left-0 z-10 px-3 py-2 text-left font-normal',
                  row.isSubject ? 'bg-surface-sunken' : 'bg-surface-card',
                )}
              >
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'whitespace-nowrap',
                        row.isSubject ? 'font-semibold text-ink-primary' : 'text-ink-secondary',
                      )}
                    >
                      {row.name}
                    </span>
                    <OriginBadge origin={row.origin} />
                  </span>
                  <span className="text-micro text-ink-subtle">{row.ticker}</span>
                </span>
              </th>
              {KPI_DEFINITIONS.map((definition) => {
                const snapshot = row.kpis.find((entry) => entry.kpiId === definition.id)
                return (
                  <td
                    key={definition.id}
                    className={cn(
                      'tabular px-3 py-2 text-right whitespace-nowrap',
                      row.isSubject ? 'font-semibold text-ink-primary' : 'text-ink-secondary',
                    )}
                  >
                    {formatKpiValue(snapshot?.value ?? null, definition)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
