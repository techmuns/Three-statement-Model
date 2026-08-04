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
 * A batch run no longer scrapes a fixed subset; it scrapes the stalest N of
 * `ALL_COMPANIES` (see `rotation.ts`), so coverage grows across the whole
 * registry over many runs. `--company <SYMBOL>` still resolves any single one.
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

function toScraperCompany(entry: RegistryEntry): ScraperCompany {
  return { companyId: entry.symbol, screenerSymbol: entry.symbol, name: entry.name }
}

/** The full ~500-company registry, in registry order. */
export const ALL_COMPANIES: readonly ScraperCompany[] = REGISTRY.map(toScraperCompany)

const BY_SYMBOL = new Map(ALL_COMPANIES.map((company) => [company.screenerSymbol, company]))

/** Resolve a `--company` argument (any registry symbol) to a company. */
export function findScraperCompany(query: string): ScraperCompany | undefined {
  return BY_SYMBOL.get(query.trim().toUpperCase())
}
