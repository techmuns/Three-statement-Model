/**
 * KPI values for the five tracked companies.
 *
 * Computed from the annual statements in `financials.ts` rather than authored,
 * so a KPI can never contradict the statement it claims to summarise. Peer
 * statistics come from the carried values in `peers.ts`.
 *
 * The real pipeline will do exactly this: scrape statements, then derive the
 * KPI set. Nothing here needs to change when the inputs become real.
 */

import { KPI_DEFINITIONS, KPI_IDS, findKpiDefinition } from '@/config/kpis'
import type { Reported } from '@/types/common'
import type { BalanceSheetPeriod, ProfitLossPeriod } from '@/types/financials'
import { periodsOf } from '@/types/financials'
import type {
  CompanyKpiHistory,
  CompanyKpis,
  KpiDirection,
  KpiHistoryStat,
  KpiId,
  KpiPeerStats,
  KpiTrendPoint,
  KpiValue,
} from '@/types/kpi'
import type { PeerComparisonRow, PeerGroup, PeerKpiSnapshot } from '@/types/peers'
import { MOCK_COMPANIES } from './companies'
import { getCompanyFinancials } from './financials'
import { getPeerGroupForCompany } from './peers'

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/* -------------------------------------------------------------------------- */
/* Derivation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * One KPI for one financial year.
 *
 * `previousProfitLoss` is only needed by revenue growth, and is `null` for the
 * oldest year we hold — which is why growth is `null` there rather than zero.
 */
function computeKpi(
  kpiId: KpiId,
  profitLoss: ProfitLossPeriod,
  balanceSheet: BalanceSheetPeriod,
  previousProfitLoss: ProfitLossPeriod | null,
): Reported<number> {
  const netWorth = balanceSheet.equityCapital + balanceSheet.reserves
  const capitalEmployed = netWorth + balanceSheet.borrowings
  const definition = findKpiDefinition(kpiId)

  switch (kpiId) {
    case 'revenue-growth':
      if (!previousProfitLoss || previousProfitLoss.sales === 0) return null
      return round((profitLoss.sales / previousProfitLoss.sales - 1) * 100, definition.precision)

    case 'operating-margin':
      return round(profitLoss.opmPercent, definition.precision)

    case 'net-profit-margin':
      return round((profitLoss.netProfit / profitLoss.sales) * 100, definition.precision)

    case 'return-on-equity':
      if (netWorth === 0) return null
      return round((profitLoss.netProfit / netWorth) * 100, definition.precision)

    case 'return-on-capital-employed':
      if (capitalEmployed === 0) return null
      return round(
        ((profitLoss.profitBeforeTax + profitLoss.interest) / capitalEmployed) * 100,
        definition.precision,
      )

    case 'debt-to-equity':
      if (netWorth === 0) return null
      return round(balanceSheet.borrowings / netWorth, definition.precision)
  }
}

function median(values: readonly number[]): Reported<number> {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function average(values: readonly number[]): Reported<number> {
  if (values.length === 0) return null
  return values.reduce((total, value) => total + value, 0) / values.length
}

function peerStats(
  kpiId: KpiId,
  companyValue: Reported<number>,
  group: PeerGroup | null,
): KpiPeerStats {
  const peerValues = (group?.peers ?? [])
    .map((entry) => entry.kpis.find((snapshot) => snapshot.kpiId === kpiId)?.value ?? null)
    .filter((value): value is number => value !== null)

  const definition = findKpiDefinition(kpiId)
  const averageValue = average(peerValues)
  const medianValue = median(peerValues)
  // Low/high are the min/max of the very same set used for average/median, so
  // they can never disagree with it (e.g. low ≤ average ≤ high always holds).
  const lowValue = peerValues.length > 0 ? Math.min(...peerValues) : null
  const highValue = peerValues.length > 0 ? Math.max(...peerValues) : null

  // Rank the company against the peers plus itself. Direction-aware: for a
  // lower-is-better KPI such as debt-to-equity, the smallest value ranks 1.
  let rank: Reported<number> = null
  if (companyValue !== null && peerValues.length > 0) {
    const better = peerValues.filter((value) =>
      definition.direction === 'higher-is-better' ? value > companyValue : value < companyValue,
    ).length
    rank = better + 1
  }

  return {
    average: averageValue === null ? null : round(averageValue, definition.precision),
    median: medianValue === null ? null : round(medianValue, definition.precision),
    low: lowValue === null ? null : round(lowValue, definition.precision),
    high: highValue === null ? null : round(highValue, definition.precision),
    rank,
    rankedOutOf: peerValues.length + 1,
  }
}

function buildCompanyKpis(companyId: string): CompanyKpis | null {
  // Derives from whatever `getCompanyFinancials` returns — real scraped data
  // where present, mock otherwise — so KPIs track the real statements with no
  // extra wiring. (Peer stats below stay mock until peers are scraped.)
  const financials = getCompanyFinancials(companyId)
  if (!financials) return null

  const profitLossPeriods = periodsOf(financials.annual.profitLoss)
  const balanceSheetPeriods = periodsOf(financials.annual.balanceSheet)
  if (profitLossPeriods.length === 0 || balanceSheetPeriods.length === 0) return null

  const group = getPeerGroupForCompany(companyId)
  const latestIndex = profitLossPeriods.length - 1

  const values: KpiValue[] = KPI_IDS.map((kpiId) => {
    const trend: KpiTrendPoint[] = profitLossPeriods.map((profitLoss, index) => ({
      periodId: profitLoss.period.id,
      value: computeKpi(
        kpiId,
        profitLoss,
        balanceSheetPeriods[index],
        index > 0 ? profitLossPeriods[index - 1] : null,
      ),
    }))

    const value = trend[latestIndex].value
    const previousValue = latestIndex > 0 ? trend[latestIndex - 1].value : null

    return { kpiId, value, previousValue, trend, peer: peerStats(kpiId, value, group) }
  })

  return {
    companyId,
    asOfPeriodId: profitLossPeriods[latestIndex].period.id,
    peerGroupId: group?.id ?? null,
    values,
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/** Keyed by `MockCompany.id`. */
export const COMPANY_KPIS: Readonly<Record<string, CompanyKpis>> = Object.fromEntries(
  MOCK_COMPANIES.map((company) => [company.id, buildCompanyKpis(company.id)] as const).filter(
    (entry): entry is readonly [string, CompanyKpis] => entry[1] !== null,
  ),
)

export function getCompanyKpis(companyId: string): CompanyKpis | null {
  return COMPANY_KPIS[companyId] ?? null
}

/* -------------------------------------------------------------------------- */
/* Historical self-comparison                                                 */
/* -------------------------------------------------------------------------- */

function isBetter(candidate: number, incumbent: number, direction: KpiDirection): boolean {
  return direction === 'higher-is-better' ? candidate > incumbent : candidate < incumbent
}

/**
 * Summarise one KPI's trailing `trend` into a self-comparison: the average of
 * the periods held, the best period (direction-aware), and how the latest value
 * sits against that average.
 */
function buildHistoryStat(value: KpiValue): KpiHistoryStat {
  const definition = findKpiDefinition(value.kpiId)
  // Drop periods with no value (e.g. revenue growth's oldest year), narrowing
  // to a concrete number so the reductions below need no further null checks.
  const points = value.trend.flatMap((point) =>
    point.value === null ? [] : [{ periodId: point.periodId, value: point.value }],
  )

  const averageValue = average(points.map((point) => point.value))
  const periodAverage = averageValue === null ? null : round(averageValue, definition.precision)

  let best: KpiHistoryStat['best'] = null
  for (const point of points) {
    if (best === null || isBetter(point.value, best.value, definition.direction)) best = point
  }

  const deltaVsAverage =
    value.value !== null && periodAverage !== null
      ? round(value.value - periodAverage, definition.precision)
      : null

  let standing: KpiHistoryStat['standing'] = null
  if (deltaVsAverage !== null) {
    if (deltaVsAverage === 0) standing = 'in-line'
    else standing = deltaVsAverage > 0 === (definition.direction === 'higher-is-better') ? 'better' : 'worse'
  }

  return { kpiId: value.kpiId, current: value.value, periodAverage, best, deltaVsAverage, standing }
}

/**
 * Per-KPI historical self-comparison for a company. Generic over real/mock data
 * — it derives from `getCompanyKpis`, so it works identically for a scraped
 * company and a mock one. `null` when the company has no computable KPIs.
 */
export function getCompanyKpiHistory(companyId: string): CompanyKpiHistory | null {
  const kpis = getCompanyKpis(companyId)
  if (!kpis) return null
  return {
    companyId,
    asOfPeriodId: kpis.asOfPeriodId,
    stats: kpis.values.map(buildHistoryStat),
  }
}

/** A company's KPI values flattened into peer-comparison snapshots. */
function snapshotsFor(companyId: string): readonly PeerKpiSnapshot[] {
  const kpis = COMPANY_KPIS[companyId]
  if (!kpis) return KPI_DEFINITIONS.map((definition) => ({ kpiId: definition.id, value: null }))
  return kpis.values.map((value) => ({ kpiId: value.kpiId, value: value.value }))
}

/**
 * Rows for a peer comparison table, ready to render: the subject company first,
 * then any tracked companies in the same group, then the carried peers.
 *
 * Tracked rows are marked `derived` and carry no market cap, since we do not
 * hold a price feed — that arrives with the market-data phase.
 */
export function getPeerComparison(companyId: string): readonly PeerComparisonRow[] {
  const group = getPeerGroupForCompany(companyId)
  if (!group) return []

  const trackedRows: PeerComparisonRow[] = group.memberCompanyIds.map((memberId) => {
    const company = MOCK_COMPANIES.find((entry) => entry.id === memberId)

    return {
      id: memberId,
      name: company?.name ?? memberId,
      ticker: company?.ticker ?? '—',
      origin: 'derived',
      isSubject: memberId === companyId,
      marketCapCrore: null,
      kpis: snapshotsFor(memberId),
    }
  })

  const carriedRows: PeerComparisonRow[] = group.peers.map((entry) => ({
    id: entry.id,
    name: entry.name,
    ticker: entry.ticker,
    origin: 'carried',
    isSubject: false,
    marketCapCrore: entry.marketCapCrore,
    kpis: entry.kpis,
  }))

  return [
    ...trackedRows.filter((row) => row.isSubject),
    ...trackedRows.filter((row) => !row.isSubject),
    ...carriedRows,
  ]
}
