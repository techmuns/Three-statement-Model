/**
 * The company universe the scraper walks, sourced from the shared registry.
 *
 * `company-registry.json` at the repo root is the single source of truth shared
 * with the frontend, so the two can never drift. Each entry's NSE `symbol` is
 * the canonical id: it is the Screener slug in the company URL
 * (`https://www.screener.in/company/<symbol>/`), the `data/<symbol>.json`
 * output stem, and `CompanyFinancials.companyId` — so `companyId` and
 * `screenerSymbol` are the same value here.
 *
 * A batch run scrapes the stalest N of `ROTATION_COMPANIES` — the registry
 * filtered to `ACTIVE_INDEX` (NIFTY 50 for now; see `rotation.ts`) — so coverage
 * grows across the active universe over many runs. `--company <SYMBOL>` still
 * resolves any single one of the full registry.
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
  /** NSE indices this company belongs to, e.g. `["NIFTY 500", "NIFTY 50"]`. */
  indices: readonly string[]
}

const REGISTRY = (registryDoc as { companies: readonly RegistryEntry[] }).companies

function toScraperCompany(entry: RegistryEntry): ScraperCompany {
  return { companyId: entry.symbol, screenerSymbol: entry.symbol, name: entry.name }
}

/** The full ~500-company registry, in registry order. Used for on-demand
 * single-company lookups (`--company`), which may target any of the 500. */
export const ALL_COMPANIES: readonly ScraperCompany[] = REGISTRY.map(toScraperCompany)

/**
 * The index the rotation is scoped to. Narrowed to NIFTY 50 for now, to get
 * fast, dense real coverage of the 50 largest companies. Widen it back to
 * `'NIFTY 500'` (every entry carries that tag) to resume full-registry
 * rotation — this one constant is the whole switch.
 */
export const ACTIVE_INDEX = 'NIFTY 50'

/**
 * The rotation pool: the registry filtered to `ACTIVE_INDEX`. `rotation.ts`
 * ranks these by staleness and a batch scrapes the stalest few.
 */
export const ROTATION_COMPANIES: readonly ScraperCompany[] = REGISTRY.filter((entry) =>
  entry.indices.includes(ACTIVE_INDEX),
).map(toScraperCompany)

const BY_SYMBOL = new Map(ALL_COMPANIES.map((company) => [company.screenerSymbol, company]))

/** Resolve a `--company` argument (any registry symbol) to a company. */
export function findScraperCompany(query: string): ScraperCompany | undefined {
  return BY_SYMBOL.get(query.trim().toUpperCase())
}
