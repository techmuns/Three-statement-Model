/**
 * Reporting periods.
 *
 * Indian financial years run April→March and are named for the calendar year
 * they end in: FY26 covers April 2025 to March 2026, and its Q1 ends June 2025.
 * Screener labels columns `Jun 2025` / `Mar 2026`; `PeriodRef` keeps both the
 * machine key and the label a reader expects.
 */

import type { PeriodViewId } from '@/config/navigation'

export type PeriodCadence = 'quarterly' | 'annual'

/** Quarter within an Indian financial year. Q1 ends June, Q4 ends March. */
export type FiscalQuarter = 1 | 2 | 3 | 4

export interface PeriodRef {
  /** Stable key, e.g. `FY26Q1` or `FY26`. Used to join segments to periods. */
  readonly id: string
  /** Short display label, e.g. `Q1 FY26` or `FY26`. */
  readonly label: string
  /** Long display label, e.g. `Quarter ended Jun 2025`. */
  readonly longLabel: string
  readonly cadence: PeriodCadence
  /** Financial year the period belongs to, named by its ending year: 2026 = FY26. */
  readonly fiscalYear: number
  /** Present only on quarterly periods. */
  readonly quarter: FiscalQuarter | null
  /** ISO-8601 date the period ends. The canonical sort key. */
  readonly endDate: string
}

/**
 * Which cadence a period toggle in the UI selects.
 *
 * The UI's `PeriodViewId` and the data layer's `PeriodCadence` are separate on
 * purpose — the toggle is a view concern that may grow options ("Last 10
 * years", "TTM") that are not new cadences. This is the one place they meet.
 */
export const PERIOD_VIEW_TO_CADENCE: Readonly<Record<PeriodViewId, PeriodCadence>> = {
  quarters: 'quarterly',
  years: 'annual',
}

/** Oldest → newest. Every series in this schema is stored in this order. */
export function sortPeriodsAscending<T extends { readonly period: PeriodRef }>(
  entries: readonly T[],
): readonly T[] {
  return [...entries].sort((a, b) => a.period.endDate.localeCompare(b.period.endDate))
}
