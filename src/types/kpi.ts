/**
 * KPI schema.
 *
 * A KPI is a single scalar derived from the statements, carried alongside the
 * peer-set statistics needed to say whether the number is good. Definitions
 * (label, unit, formula) live in `src/config/kpis.ts`; the values live in
 * `src/mocks/kpis.ts` and are computed from the statement data, so a KPI can
 * never contradict the statement it came from.
 */

import type { Reported } from './common'

/** The fixed standard set. Adding one is an edit here and in `config/kpis.ts`. */
export type KpiId =
  | 'revenue-growth'
  | 'operating-margin'
  | 'net-profit-margin'
  | 'return-on-equity'
  | 'return-on-capital-employed'
  | 'debt-to-equity'

export type KpiUnit = 'percent' | 'ratio'

/** Which way is good. Drives delta colouring and peer ranking. */
export type KpiDirection = 'higher-is-better' | 'lower-is-better'

export interface KpiDefinition {
  readonly id: KpiId
  /** Full label, e.g. "Return on Capital Employed". */
  readonly label: string
  /** Terse label for a table header or chart axis, e.g. "ROCE". */
  readonly shortLabel: string
  readonly unit: KpiUnit
  readonly direction: KpiDirection
  /** Plain-language derivation, shown as a methodology note. */
  readonly formula: string
  /** Decimal places to render. */
  readonly precision: number
  /** Why an analyst looks at it. */
  readonly description: string
}

/** One point on a KPI's trailing trend. */
export interface KpiTrendPoint {
  /** Matches `PeriodRef.id`. */
  readonly periodId: string
  readonly value: Reported<number>
}

/** Peer-set statistics for one KPI, computed across the company's peer group. */
export interface KpiPeerStats {
  readonly average: Reported<number>
  readonly median: Reported<number>
  /** Best-to-worst position of the company within peers + itself, 1 = best.
   * Direction-aware: for `lower-is-better`, the smallest value ranks 1. */
  readonly rank: Reported<number>
  /** Number of companies the rank is out of, the company included. */
  readonly rankedOutOf: number
}

export interface KpiValue {
  readonly kpiId: KpiId
  /** Latest reported value, `null` when it cannot be computed. */
  readonly value: Reported<number>
  /** The prior financial year's value, for a year-on-year delta. */
  readonly previousValue: Reported<number>
  /** Trailing values, oldest → newest, one per annual period. */
  readonly trend: readonly KpiTrendPoint[]
  readonly peer: KpiPeerStats
}

export interface CompanyKpis {
  /** Joins to `MockCompany.id`. */
  readonly companyId: string
  /** Period the headline values are as of. Matches `PeriodRef.id`. */
  readonly asOfPeriodId: string
  /** Joins to `PeerGroup.id`. `null` when the company has no peer cohort, in
   * which case every `KpiValue.peer` stat is `null` too. */
  readonly peerGroupId: string | null
  readonly values: readonly KpiValue[]
}

/** Look up one KPI within a company's set. */
export function findKpiValue(kpis: CompanyKpis, kpiId: KpiId): KpiValue | null {
  return kpis.values.find((value) => value.kpiId === kpiId) ?? null
}
