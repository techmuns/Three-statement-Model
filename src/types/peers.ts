/**
 * Peer / comparable-company schema.
 *
 * A peer group is a sector cohort. Tracked companies (the ones in
 * `src/mocks/companies.ts`) map into a group; the group additionally lists
 * external comparables whose KPI values are carried directly, since we hold no
 * statements for them.
 *
 * Two tracked companies can share a group — TCS and Infosys both sit in IT
 * Services — so a comparison table can put derived values beside carried ones.
 * `PeerComparisonRow` is the flattened shape for exactly that table.
 */

import type { Crore, Reported } from './common'
import type { KpiId } from './kpi'

export type PeerGroupId = 'it-services' | 'private-banks' | 'fmcg' | 'oil-gas-energy'

/** One KPI value carried for an external peer. */
export interface PeerKpiSnapshot {
  readonly kpiId: KpiId
  readonly value: Reported<number>
}

export interface PeerCompany {
  readonly id: string
  readonly name: string
  /** Illustrative, as with the tracked companies. */
  readonly ticker: string
  readonly marketCapCrore: Crore
  readonly kpis: readonly PeerKpiSnapshot[]
}

export interface PeerGroup {
  readonly id: PeerGroupId
  readonly label: string
  /** Matches the `sector` string on the tracked companies in this group. */
  readonly sector: string
  /** Tracked company ids that use this group for comparison. */
  readonly memberCompanyIds: readonly string[]
  /** External comparables. Excludes the tracked members themselves. */
  readonly peers: readonly PeerCompany[]
}

/**
 * A single row of a peer comparison table: one company, all KPIs.
 *
 * `origin` records where the numbers came from — `derived` rows are computed
 * from statements we hold and can be drilled into; `carried` rows are the
 * external peers' headline values with no statements behind them. The UI should
 * not offer a drill-down on a carried row.
 */
export interface PeerComparisonRow {
  readonly id: string
  readonly name: string
  readonly ticker: string
  readonly origin: 'derived' | 'carried'
  /** True for the company the comparison is centred on. */
  readonly isSubject: boolean
  readonly marketCapCrore: Reported<Crore>
  readonly kpis: readonly PeerKpiSnapshot[]
}
