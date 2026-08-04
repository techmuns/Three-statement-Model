/**
 * Real scraped financials, loaded at build time.
 *
 * The scraper writes one `data/<SYMBOL>.json` per company at the repo root.
 * Vite inlines whatever exists there at build time via `import.meta.glob`; each
 * file self-identifies by its `companyId`, so no symbol↔id map is needed here.
 * Files that don't validate are dropped (with a warning) so the caller falls
 * back to mock data for that company — a malformed file never reaches a view.
 *
 * If `data/` is empty (the scraper hasn't run), this is simply an empty map and
 * every company falls back to its authored mock.
 */

import type { CompanyFinancials } from '@/types/financials'
import { isCompanyFinancials } from './validateFinancials'

const files = import.meta.glob<unknown>('/data/*.json', { eager: true, import: 'default' })

function loadScrapedFinancials(): ReadonlyMap<string, CompanyFinancials> {
  const byCompanyId = new Map<string, CompanyFinancials>()
  for (const [path, value] of Object.entries(files)) {
    if (isCompanyFinancials(value)) {
      byCompanyId.set(value.companyId, value)
    } else {
      console.warn(
        `[data] Ignoring malformed scraped file "${path}"; its company falls back to mock data.`,
      )
    }
  }
  return byCompanyId
}

const SCRAPED_FINANCIALS = loadScrapedFinancials()

/** Real scraped financials for a company, or `null` when none exist or valid. */
export function getScrapedFinancials(companyId: string): CompanyFinancials | null {
  return SCRAPED_FINANCIALS.get(companyId) ?? null
}
