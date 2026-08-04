/**
 * The company universe the scraper walks, sourced from the shared registry.
 *
 * `company-registry.json` at the repo root is the single source of truth shared
 * with the frontend, so the two can never drift. Each entry's NSE `symbol` is
 * the canonical id: it is the Screener slug in the company URL
 * (`https://www.screener.in/company/<symbol>/`), the `data/<symbol>.json`
 * output stem, and `CompanyFinancials.companyId` — so `companyId` and
 * `screenerSymbol` are the same value here.
 */

import registryDoc from '../../company-registry.json'

export interface ScraperCompany {
  /** Joins to `CompanyFinancials.companyId` — the NSE symbol. */
  readonly companyId: string
  /** Screener.in URL symbol, e.g. `RELIANCE`. Also the output filename stem. */
  readonly screenerSymbol: string
  /** Display name, for logs. */
  readonly name: string
}

interface RegistryEntry {
  symbol: string
  name: string
  sector: string
}

const REGISTRY = (registryDoc as { companies: readonly RegistryEntry[] }).companies
const REGISTRY_BY_SYMBOL = new Map(REGISTRY.map((entry) => [entry.symbol, entry]))

function toScraperCompany(entry: RegistryEntry): ScraperCompany {
  return { companyId: entry.symbol, screenerSymbol: entry.symbol, name: entry.name }
}

/**
 * The subset a batch run (`--all`, and so the scheduled GitHub Action) actually
 * scrapes today.
 *
 * The registry is the full ~500-company universe, but scraping all of them is a
 * separate scaling phase — it needs batching, rate-limiting and a bigger CI
 * time budget than the current workflow allows. Until then, `--all` stays
 * bounded to this proven set so the scheduled job keeps finishing quickly.
 * `--company <SYMBOL>` still resolves against the whole registry, so any of the
 * 500 can be scraped on demand.
 */
export const ACTIVE_SYMBOLS: readonly string[] = [
  'RELIANCE',
  'TCS',
  'HDFCBANK',
  'INFY',
  'HINDUNILVR',
]

export const SCRAPER_COMPANIES: readonly ScraperCompany[] = ACTIVE_SYMBOLS.map((symbol) =>
  REGISTRY_BY_SYMBOL.get(symbol),
)
  .filter((entry): entry is RegistryEntry => entry !== undefined)
  .map(toScraperCompany)

/** Resolve a `--company` argument (any registry symbol) to a company. */
export function findScraperCompany(query: string): ScraperCompany | undefined {
  const entry = REGISTRY_BY_SYMBOL.get(query.trim().toUpperCase())
  return entry ? toScraperCompany(entry) : undefined
}
