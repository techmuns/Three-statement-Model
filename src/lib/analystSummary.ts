/**
 * A templated, data-supported analyst summary.
 *
 * Every point is generated from real evidence — a KPI against its real sector
 * peers, or a KPI against the company's own trailing history — and states the
 * numbers behind it. Nothing here is freeform prose or an unsupported claim: if
 * the data does not support a point, it is not made, and fewer than three points
 * in a bucket is a valid result.
 */

import { findKpiDefinition } from '@/config/kpis'
import { formatKpiValue } from '@/lib/kpiFormat'
import type { SectorPeerPositioning } from '@/mocks/sectorPeers'
import type { CompanyKpiHistory, KpiId } from '@/types/kpi'

export interface AnalystPoint {
  readonly kpiId: KpiId
  readonly text: string
}

export interface AnalystSummary {
  readonly strengths: readonly AnalystPoint[]
  readonly watchItems: readonly AnalystPoint[]
}

const MAX_POINTS = 3
/** Ignore differences smaller than this share of the reference — noise, not signal. */
const REL_THRESHOLD = 0.03

interface Candidate {
  readonly kpiId: KpiId
  readonly text: string
  readonly favorable: boolean
  /** Peer evidence outranks self-history evidence for the same KPI. */
  readonly isPeer: boolean
  readonly weight: number
}

function relMagnitude(subject: number, reference: number): number {
  return Math.abs(subject - reference) / (Math.abs(reference) + 1e-6)
}

/**
 * Build the summary from the KPI set, the self-history, and — where the sector
 * has enough real scraped peers — the peer positioning. One point per KPI (the
 * strongest signal), classified as a strength or a watch item and trimmed to the
 * three strongest of each.
 */
export function buildAnalystSummary(
  history: CompanyKpiHistory | null,
  positioning: SectorPeerPositioning | null,
): AnalystSummary {
  const strongest = new Map<KpiId, Candidate>()
  const consider = (candidate: Candidate) => {
    const existing = strongest.get(candidate.kpiId)
    // Prefer peer evidence; within the same source, prefer the larger gap.
    if (
      !existing ||
      (candidate.isPeer && !existing.isPeer) ||
      (candidate.isPeer === existing.isPeer && candidate.weight > existing.weight)
    ) {
      strongest.set(candidate.kpiId, candidate)
    }
  }

  // Peer evidence — only when the sector has enough real peers to be meaningful.
  if (positioning?.hasEnough) {
    for (const stat of positioning.stats) {
      if (stat.subjectValue === null) continue
      const definition = findKpiDefinition(stat.kpiId)
      const relative = relMagnitude(stat.subjectValue, stat.median)
      if (relative < REL_THRESHOLD) continue
      const above = stat.subjectValue > stat.median
      const favorable = definition.direction === 'higher-is-better' ? above : !above
      consider({
        kpiId: stat.kpiId,
        favorable,
        isPeer: true,
        weight: relative,
        text: `${definition.label} (${formatKpiValue(stat.subjectValue, definition)}) is ${
          above ? 'above' : 'below'
        } the sector median of ${formatKpiValue(stat.median, definition)}.`,
      })
    }
  }

  // Self-history evidence — the latest value against the trailing average.
  if (history) {
    for (const stat of history.stats) {
      if (stat.current === null || stat.periodAverage === null) continue
      const definition = findKpiDefinition(stat.kpiId)
      const relative = relMagnitude(stat.current, stat.periodAverage)
      if (relative < REL_THRESHOLD) continue
      const above = stat.current > stat.periodAverage
      const favorable = definition.direction === 'higher-is-better' ? above : !above
      consider({
        kpiId: stat.kpiId,
        favorable,
        isPeer: false,
        weight: relative,
        text: `${definition.label} (${formatKpiValue(stat.current, definition)}) is ${
          above ? 'above' : 'below'
        } its 5-year average of ${formatKpiValue(stat.periodAverage, definition)}.`,
      })
    }
  }

  const candidates = [...strongest.values()]
  const pick = (favorable: boolean): AnalystPoint[] =>
    candidates
      .filter((candidate) => candidate.favorable === favorable)
      .sort((a, b) => Number(b.isPeer) - Number(a.isPeer) || b.weight - a.weight)
      .slice(0, MAX_POINTS)
      .map((candidate) => ({ kpiId: candidate.kpiId, text: candidate.text }))

  return { strengths: pick(true), watchItems: pick(false) }
}
