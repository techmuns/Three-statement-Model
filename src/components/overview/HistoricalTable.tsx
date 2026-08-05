import { findKpiDefinition } from '@/config/kpis'
import { DeltaBadge } from '@/components/widgets/DeltaBadge'
import { WidgetCard } from '@/components/widgets/WidgetCard'
import { formatKpiGap, formatKpiValue } from '@/lib/kpiFormat'
import type { StatusTone } from '@/theme/tokens'
import type { CompanyKpiHistory, KpiHistoryStat } from '@/types/kpi'

const standingTone: Record<NonNullable<KpiHistoryStat['standing']>, StatusTone> = {
  better: 'good',
  worse: 'critical',
  'in-line': 'neutral',
}

/**
 * The self-comparison table: each KPI's current value against its own trailing
 * history — the 5-year average, the best period held, and the current-vs-average
 * delta. Derived entirely from `getCompanyKpiHistory`, so it never disagrees with
 * the scorecards above.
 */
export function HistoricalTable({ history }: { history: CompanyKpiHistory }) {
  return (
    <WidgetCard title="Historical self-comparison" subtitle={`As of ${history.asOfPeriodId}`} wide>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[38rem] border-collapse text-body">
          <caption className="sr-only">
            Each KPI's latest value against its own five-year history.
          </caption>
          <thead>
            <tr className="border-b border-line-hairline text-left text-caption text-ink-muted">
              <th scope="col" className="py-2 pr-3 font-medium">
                KPI
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Current
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                5-year average
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Best period
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Best value
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">
                Current vs history
              </th>
            </tr>
          </thead>
          <tbody>
            {history.stats.map((stat) => {
              const definition = findKpiDefinition(stat.kpiId)
              return (
                <tr key={stat.kpiId} className="border-b border-line-hairline/70 last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-ink-secondary">
                    {definition.label}
                  </th>
                  <td className="tabular px-3 py-2 text-right font-semibold text-ink-primary">
                    {formatKpiValue(stat.current, definition)}
                  </td>
                  <td className="tabular px-3 py-2 text-right text-ink-secondary">
                    {formatKpiValue(stat.periodAverage, definition)}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-secondary">
                    {stat.best?.periodId ?? '—'}
                  </td>
                  <td className="tabular px-3 py-2 text-right text-ink-secondary">
                    {stat.best ? formatKpiValue(stat.best.value, definition) : '—'}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    {stat.deltaVsAverage === null || stat.standing === null ? (
                      <span className="text-ink-subtle">—</span>
                    ) : (
                      <DeltaBadge
                        label={`${formatKpiGap(stat.deltaVsAverage, definition)} vs 5Y avg`}
                        tone={standingTone[stat.standing]}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </WidgetCard>
  )
}
