/**
 * KPI derivation from the real statements.
 *
 * Every value here is computed from the scraped P&L and balance sheet, so a KPI
 * can never contradict the statement it summarises. P&L-based KPIs (revenue
 * growth, operating margin, net margin) are available in both the quarterly and
 * annual views; balance-sheet KPIs (ROE, ROCE, D/E) need the balance sheet,
 * which Indian companies publish annually — so in the 5-quarter view those come
 * back `null` and the widget says so rather than inventing a figure.
 */

import { KPI_DEFINITIONS } from '@/config/kpis'
import type { KpiDefinition, KpiId } from '@/types/kpi'
import type {
  BalanceSheetPeriod,
  ProfitLossPeriod,
  StatementSet,
} from '@/types/financials'
import { periodsOf } from '@/types/financials'
import type { Reported } from '@/types/common'

export interface KpiSeriesPoint {
  periodId: string
  label: string
  value: Reported<number>
}

export interface DerivedKpi {
  id: KpiId
  definition: KpiDefinition
  /** Oldest → newest, aligned to the P&L periods (the "own comparables"). */
  series: readonly KpiSeriesPoint[]
  latest: Reported<number>
  previous: Reported<number>
  /** latest − previous, in the KPI's own unit; `null` when either is missing. */
  delta: Reported<number>
}

function equity(bs: BalanceSheetPeriod): number {
  return bs.equityCapital + bs.reserves
}

function computeForPeriod(
  id: KpiId,
  pl: ProfitLossPeriod,
  prevPl: ProfitLossPeriod | undefined,
  bs: BalanceSheetPeriod | undefined,
): Reported<number> {
  switch (id) {
    case 'revenue-growth':
      if (!prevPl || prevPl.sales === 0) return null
      return (pl.sales / prevPl.sales - 1) * 100
    case 'operating-margin':
      return pl.opmPercent
    case 'net-profit-margin':
      return pl.sales === 0 ? null : (pl.netProfit / pl.sales) * 100
    case 'return-on-equity':
      return bs && equity(bs) !== 0 ? (pl.netProfit / equity(bs)) * 100 : null
    case 'return-on-capital-employed': {
      if (!bs) return null
      const capitalEmployed = equity(bs) + bs.borrowings
      return capitalEmployed !== 0 ? ((pl.profitBeforeTax + pl.interest) / capitalEmployed) * 100 : null
    }
    case 'debt-to-equity':
      return bs && equity(bs) !== 0 ? bs.borrowings / equity(bs) : null
    default:
      return null
  }
}

/** Derive every standard KPI as a trailing series for the selected cadence. */
export function deriveKpis(set: StatementSet): readonly DerivedKpi[] {
  const plPeriods = periodsOf(set.profitLoss)
  const bsById = new Map(periodsOf(set.balanceSheet).map((b) => [b.period.id, b]))

  return KPI_DEFINITIONS.map((definition) => {
    const series: KpiSeriesPoint[] = plPeriods.map((pl, i) => ({
      periodId: pl.period.id,
      label: pl.period.label,
      value: computeForPeriod(definition.id, pl, plPeriods[i - 1], bsById.get(pl.period.id)),
    }))
    const withValues = series.filter((p) => p.value !== null)
    const latest = series.length ? series[series.length - 1].value : null
    const previous = series.length > 1 ? series[series.length - 2].value : null
    const delta = latest !== null && previous !== null ? latest - previous : null
    return {
      id: definition.id,
      definition,
      series,
      latest,
      previous,
      delta: withValues.length >= 2 ? delta : null,
    }
  })
}
