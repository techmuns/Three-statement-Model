/**
 * The company universe, sourced from the shared registry.
 *
 * `company-registry.json` at the repo root is the single source of truth for
 * the ~500 Nifty 500 constituents; the scraper reads the same file. This module
 * adapts each registry entry into the `MockCompany` shape the UI renders and
 * derives the presentational bits (monogram, colour slot) that the registry
 * deliberately does not store. The universe shown is scoped to `ACTIVE_INDEX`
 * (NIFTY 50 for now) via a single filter — see below.
 *
 * The `id` is the NSE trading symbol — the canonical company identifier used
 * everywhere: it is the join key to `CompanyFinancials.companyId`, the Screener
 * slug in the company URL, and the `data/<symbol>.json` filename stem. (The type
 * and const keep their historical `Mock*` names for import stability; the data
 * is the real universe, and only the original five have authored mock
 * financials behind them — every other company shows an honest "awaiting data"
 * state until it is scraped.)
 */

import registryDoc from '../../company-registry.json'

export interface MockCompany {
  /** NSE trading symbol — the canonical id, Screener slug and data-file stem. */
  id: string
  name: string
  /** NSE trading symbol (same value as `id`), shown as the ticker. */
  ticker: string
  sector: string
  /** Two-letter monogram used in place of a logo asset. */
  monogram: string
  /** Series slot used to tint the monogram, so a company keeps one colour. */
  colorIndex: number
}

interface RegistryEntry {
  symbol: string
  name: string
  sector: string
  /** NSE indices this company belongs to, e.g. ["NIFTY 500", "NIFTY 50"]. */
  indices: readonly string[]
}

/**
 * The index the switcher is scoped to. Narrowed to NIFTY 50 for now, for a
 * dense, well-covered universe; widen it back to `'NIFTY 500'` (every entry
 * carries that tag) to show the full list again — this one constant is the
 * whole switch, applied as a single filter below.
 */
const ACTIVE_INDEX = 'NIFTY 50'

const REGISTRY = (registryDoc as { companies: readonly RegistryEntry[] }).companies.filter(
  (entry) => entry.indices.includes(ACTIVE_INDEX),
)

/** First letters of the first two words, or the first two letters of one word. */
function monogramOf(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '—'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** Stable, order-independent palette slot derived from the symbol. */
function colorIndexOf(symbol: string): number {
  let hash = 0
  for (let i = 0; i < symbol.length; i += 1) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0
  return hash % 8
}

export const MOCK_COMPANIES: readonly MockCompany[] = REGISTRY.map((entry) => ({
  id: entry.symbol,
  name: entry.name,
  ticker: entry.symbol,
  sector: entry.sector,
  monogram: monogramOf(entry.name),
  colorIndex: colorIndexOf(entry.symbol),
}))

const COMPANIES_BY_ID: ReadonlyMap<string, MockCompany> = new Map(
  MOCK_COMPANIES.map((company) => [company.id, company]),
)

/** Open on a company that has real data, so the first screen is populated. */
const PREFERRED_DEFAULT = 'RELIANCE'
export const DEFAULT_COMPANY_ID =
  COMPANIES_BY_ID.get(PREFERRED_DEFAULT)?.id ?? MOCK_COMPANIES[0].id

export function findCompany(id: string): MockCompany {
  return COMPANIES_BY_ID.get(id) ?? MOCK_COMPANIES[0]
}

/** Case-insensitive match across name, ticker and sector. */
export function searchCompanies(query: string): readonly MockCompany[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return MOCK_COMPANIES

  return MOCK_COMPANIES.filter((company) =>
    `${company.name} ${company.ticker} ${company.sector}`.toLowerCase().includes(needle),
  )
}
