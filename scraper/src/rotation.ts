/**
 * Staleness-based rotation over the full company registry.
 *
 * A batch run scrapes only the N stalest companies, where staleness is: a
 * company with no data file is maximally stale, and among those that have one,
 * the older its `source.fetchedAt`, the staler. So never-scraped companies fill
 * in first; once every company has a file, the same ranking naturally cycles
 * back to whichever was refreshed longest ago — no separate reset logic.
 *
 * The selection is pure given a `readFetchedAt` reader, so it is unit-testable
 * without touching the filesystem.
 */

import type { ScraperCompany } from './companies'

/**
 * Sort key for staleness: smaller = staler. Never-fetched (`null`) sorts before
 * every real timestamp; otherwise it is the parsed `fetchedAt` epoch (an
 * unparseable timestamp is treated as never-fetched).
 */
export function staleKey(fetchedAt: string | null): number {
  if (fetchedAt === null) return Number.NEGATIVE_INFINITY
  const time = Date.parse(fetchedAt)
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

/**
 * The `batchSize` stalest companies, stalest first. Ties (e.g. several
 * never-scraped companies) break by registry order, so repeated runs march
 * through the registry deterministically rather than re-picking the same few.
 */
export async function selectStalest(
  companies: readonly ScraperCompany[],
  batchSize: number,
  readFetchedAt: (symbol: string) => Promise<string | null>,
): Promise<ScraperCompany[]> {
  const ranked = await Promise.all(
    companies.map(async (company, index) => ({
      company,
      index,
      key: staleKey(await readFetchedAt(company.screenerSymbol)),
    })),
  )

  // Comparator avoids subtracting the keys — two -Infinity keys would yield NaN.
  ranked.sort((a, b) => (a.key === b.key ? a.index - b.index : a.key < b.key ? -1 : 1))

  return ranked.slice(0, Math.max(0, batchSize)).map((entry) => entry.company)
}
