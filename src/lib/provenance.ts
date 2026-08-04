/**
 * Honest provenance strings for whatever data is on screen.
 *
 * The dashboard renders real scraped figures where they exist and authored mock
 * figures otherwise (see `getCompanyFinancials`). These helpers turn a
 * `DataSource` into user-facing text that tells the truth about which it is, so
 * a badge or footnote never claims "placeholder" over real data — or vice versa.
 */

import type { DataSource } from '@/types/common'

const UPDATED_FORMAT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** A scrape timestamp as a short readable date, e.g. `4 Aug 2026`. */
export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : UPDATED_FORMAT.format(date)
}

/** Whether a data source is real scraped data rather than the authored mock. */
export function isLiveSource(source: DataSource): boolean {
  return source.provider !== 'mock'
}

/**
 * A per-statement provenance footnote: the source and freshness for real data,
 * an explicit placeholder disclaimer for mock.
 */
export function sourceFootnote(basis: string, source: DataSource): string {
  return isLiveSource(source)
    ? `${basis} figures · source: ${source.provider}, updated ${formatUpdatedAt(source.fetchedAt)}.`
    : `${basis} figures · placeholder data, not sourced from any filing.`
}
