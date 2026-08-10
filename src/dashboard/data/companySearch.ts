/**
 * Standalone company search over the bundled registry.
 *
 * The dashboard drives itself now — no Munshot host feeds it a ticker — so it
 * carries its own searchable company list: all ~500 registry constituents for
 * autocomplete, plus free-text so any listed symbol can be entered and scraped
 * on demand. Pure and client-side; no external call.
 */

import registryDoc from '../../../company-registry.json'

export interface CompanyHit {
  symbol: string
  name: string
  sector: string
}

interface RegistryEntry {
  symbol: string
  name: string
  sector: string
}

const ALL: readonly CompanyHit[] = (
  registryDoc as { companies: readonly RegistryEntry[] }
).companies.map((c) => ({ symbol: c.symbol, name: c.name, sector: c.sector }))

const BY_SYMBOL = new Map(ALL.map((c) => [c.symbol.toUpperCase(), c]))

/** Registry display name for a symbol, or null if it's an off-registry ticker. */
export function companyName(symbol: string): string | null {
  return BY_SYMBOL.get(symbol.trim().toUpperCase())?.name ?? null
}

/** Rank: symbol prefix beats name prefix beats a looser substring match. */
function rank(hit: CompanyHit, needle: string): number {
  const sym = hit.symbol.toLowerCase()
  const name = hit.name.toLowerCase()
  if (sym === needle) return 0
  if (sym.startsWith(needle)) return 1
  if (name.startsWith(needle)) return 2
  if (sym.includes(needle)) return 3
  return 4
}

/** Up to `limit` matches across symbol, name and sector, best first. */
export function searchCompanies(query: string, limit = 8): CompanyHit[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  return ALL.filter((c) => `${c.name} ${c.symbol} ${c.sector}`.toLowerCase().includes(needle))
    .sort((a, b) => rank(a, needle) - rank(b, needle) || a.name.localeCompare(b.name))
    .slice(0, limit)
}
