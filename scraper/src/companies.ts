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
  /** BSE numeric scrip code, e.g. `"500325"`. Present only where sourced; BSE
   * identifies companies by this, not the NSE `symbol`. */
  bseScripCode?: string
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

/**
 * Resolve a symbol for an on-demand scrape of **any listed company** — not only
 * the ~500 in the registry. If we hold a registry entry we use it (for the
 * proper display name); otherwise we synthesise one, because Screener has a
 * company page per NSE symbol (`/company/<SYMBOL>/`). An unknown or delisted
 * symbol simply fails loudly when the page has no statement table — it never
 * produces fabricated data. This is what lets an analyst pull any ticker the
 * Munshot host selects, rather than being gated to a fixed universe.
 */
export function resolveScraperCompany(query: string): ScraperCompany {
  const symbol = query.trim().toUpperCase()
  return BY_SYMBOL.get(symbol) ?? { companyId: symbol, screenerSymbol: symbol, name: symbol }
}

const SCRIP_BY_SYMBOL = new Map(
  REGISTRY.filter((entry) => entry.bseScripCode).map((entry) => [entry.symbol, entry.bseScripCode!]),
)

/** The BSE scrip code for a registry symbol, or `undefined` if not sourced. */
export function bseScripCodeFor(symbol: string): string | undefined {
  return SCRIP_BY_SYMBOL.get(symbol.trim().toUpperCase())
}
