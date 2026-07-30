/**
 * Primitives shared by every part of the financial data model.
 *
 * These types are the contract the Screener.in scraper will have to satisfy in
 * a later phase, so they encode two things the real source forces on us:
 * the Indian reporting unit (₹ crore), and the fact that a statement is often
 * simply not published at a given cadence.
 */

/**
 * A rupee amount in **crore** (10 million). Every monetary figure in this
 * schema is in crore — the unit Screener.in reports in and the unit Indian
 * analysts read in. Never mix in absolute rupees.
 */
export type Crore = number

/** A percentage expressed as the number a reader sees: `17.42` means 17.42%. */
export type Percent = number

/** A plain rupee amount, used for per-share figures such as EPS. */
export type Rupees = number

/** A dimensionless ratio, e.g. debt-to-equity `0.34`. */
export type Ratio = number

/**
 * A figure the source may leave blank.
 *
 * `null` means "the source did not report this line", never "zero". A bank has
 * no capital work in progress line on Screener; that is `null`, and a chart
 * must skip the point rather than plot a zero.
 */
export type Reported<T> = T | null

/** Why a whole statement is missing at a cadence. */
export type UnavailableReason =
  /** The company does not publish this statement at this cadence at all. The
   * usual case for quarterly balance sheets and cash flow statements in India:
   * SEBI LODR requires them half-yearly, and Screener exposes annual only. */
  | 'not-reported'
  /** The source has it but we have not ingested it yet. A pipeline gap, not a
   * disclosure gap — worth retrying. */
  | 'not-scraped'
  /** Withdrawn by the company pending a restatement. */
  | 'restated'
  /** The source served the page but the section could not be parsed. */
  | 'parse-failed'

/**
 * Wraps a payload that may be entirely absent.
 *
 * Discriminated on `status`, so a consumer must handle the missing case before
 * it can touch the data:
 *
 * ```ts
 * if (set.balanceSheet.status === 'available') {
 *   set.balanceSheet.periods.forEach(…)
 * }
 * ```
 */
export type Availability<TPayload> =
  | ({ readonly status: 'available' } & TPayload)
  | {
      readonly status: 'unavailable'
      readonly reason: UnavailableReason
      /** Human-readable detail for an empty-state card. */
      readonly note?: string
    }

/** Where a figure came from, carried so the UI can show provenance. */
export interface DataSource {
  readonly provider: 'screener' | 'bse' | 'mock'
  /** Canonical source page. Absent for mock data. */
  readonly url?: string
  /** ISO-8601 timestamp of the scrape. */
  readonly fetchedAt: string
  /**
   * Screener serves consolidated figures where a company files them and
   * standalone otherwise; the two are not comparable, so it travels with the
   * data rather than being assumed.
   */
  readonly basis: 'consolidated' | 'standalone'
}
