/**
 * Real peer statistics, computed from other scraped companies in the same
 * sector.
 *
 * This is deliberately NOT the carried mock cohort in `peers.ts` (which the
 * Peer Comparison tab still uses). Here every peer value is a KPI derived from a
 * peer's own **real scraped statements** — so the low / median / high a company
 * is positioned against are real, or the section honestly says there is not
 * enough real data yet. As the rotation scrapes more of a sector, these fill in
 * on their own; nothing here is authored.
 */

import { KPI_IDS, findKpiDefinition } from '@/config/kpis'
import type { Reported } from '@/types/common'
import { findKpiValue, type KpiId } from '@/types/kpi'
import { MOCK_COMPANIES } from './companies'
import { getCompanyDataSource, getCompanyFinancials } from './financials'
import { getCompanyKpis } from './kpis'

/**
 * A sector needs at least this many real-data peers (excluding the subject)
 * before a low/median/high range is meaningful. Below it, the peer sections
 * show an honest "limited data" state rather than a thin or misleading range.
 */
export const MIN_SECTOR_PEERS = 3

export interface SectorPeerStat {
  readonly kpiId: KpiId
  readonly subjectValue: Reported<number>
  readonly low: number
  readonly median: number
  readonly high: number
  /** Peers (excluding the subject) contributing a value to this KPI. */
  readonly peerCount: number
  /** Subject's rank among peers + itself, 1 = best, direction-aware; `null`
   * when the subject has no value for this KPI. */
  readonly rank: Reported<number>
  readonly rankedOutOf: number
}

export interface SectorPeerPositioning {
  readonly companyId: string
  readonly sector: string
  /** Distinct other companies in the sector backed by real scraped KPIs. */
  readonly peerCount: number
  readonly peerNames: readonly string[]
  /** True once `peerCount >= MIN_SECTOR_PEERS`. */
  readonly hasEnough: boolean
  /** Per-KPI statistics, one per standard KPI where at least one peer has a
   * value. Consumers should still gate display on `hasEnough`. */
  readonly stats: readonly SectorPeerStat[]
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

/** Real scraped data backs this company (not the authored mock, not absent). */
function isRealData(companyId: string): boolean {
  const source = getCompanyDataSource(companyId)
  return source !== null && source.provider !== 'mock' && getCompanyFinancials(companyId) !== null
}

/**
 * The selected company's positioning against its **real** sector peers.
 *
 * `null` only when the subject itself has no KPIs. Otherwise it always returns a
 * result — but `hasEnough` is false, and `stats` may be empty, until the sector
 * has `MIN_SECTOR_PEERS` scraped peers. That is the signal the UI uses to show
 * the honest "limited peer data" state instead of a range.
 */
export function getSectorPeerPositioning(companyId: string): SectorPeerPositioning | null {
  const subjectKpis = getCompanyKpis(companyId)
  if (!subjectKpis) return null

  const subject = MOCK_COMPANIES.find((company) => company.id === companyId)
  const sector = subject?.sector ?? ''

  const peers = MOCK_COMPANIES.filter(
    (company) => company.id !== companyId && company.sector === sector && isRealData(company.id),
  )
    .map((company) => ({ name: company.name, kpis: getCompanyKpis(company.id) }))
    .filter((peer): peer is { name: string; kpis: NonNullable<ReturnType<typeof getCompanyKpis>> } =>
      peer.kpis !== null,
    )

  const stats: SectorPeerStat[] = []
  for (const kpiId of KPI_IDS) {
    const definition = findKpiDefinition(kpiId)
    const peerValues = peers
      .map((peer) => findKpiValue(peer.kpis, kpiId)?.value ?? null)
      .filter((value): value is number => value !== null)
    if (peerValues.length === 0) continue

    const subjectValue = findKpiValue(subjectKpis, kpiId)?.value ?? null
    let rank: Reported<number> = null
    if (subjectValue !== null) {
      const better = peerValues.filter((value) =>
        definition.direction === 'higher-is-better' ? value > subjectValue : value < subjectValue,
      ).length
      rank = better + 1
    }

    stats.push({
      kpiId,
      subjectValue,
      low: Math.min(...peerValues),
      median: median(peerValues),
      high: Math.max(...peerValues),
      peerCount: peerValues.length,
      rank,
      rankedOutOf: peerValues.length + 1,
    })
  }

  return {
    companyId,
    sector,
    peerCount: peers.length,
    peerNames: peers.map((peer) => peer.name),
    hasEnough: peers.length >= MIN_SECTOR_PEERS,
    stats,
  }
}
