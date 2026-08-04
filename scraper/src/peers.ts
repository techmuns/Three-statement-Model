/**
 * Mapping Screener's peer-comparison table onto the peer schema.
 *
 * Screener's peer table is a current snapshot whose columns are configurable and
 * vary from company to company — one page shows `… CMP | P/E | Mar Cap | … | ROCE
 * %`, another shows only `… CMP | Mar Cap | EV/EBITDA`. So rather than assume any
 * particular column is present, we **detect** which of our KPIs each header maps
 * to and carry only those; a KPI with no matching column is represented as
 * `null` (unavailable) — never guessed, never derived from an unrelated column
 * (e.g. the quarterly-variation columns are not our annual revenue growth).
 * Market cap maps to `PeerCompany.marketCapCrore`.
 *
 * The table is a snapshot with no history, so carried peers hold only these
 * point-in-time values — the `PeerCompany` shape carries no trend, so none is
 * fabricated. A peer whose URL symbol matches one of our tracked companies is a
 * `derived` member (it has its own full statements) and is excluded from the
 * carried list; everyone else is `carried`.
 */

import type { Crore, Reported } from '../../src/types/common'
import type { KpiId } from '../../src/types/kpi'
import type { PeerCompany, PeerGroup, PeerKpiSnapshot } from '../../src/types/peers'
import type { RawPeerTable } from './extract'
import type { PeerGroupConfig } from './peerGroups'
import { parseCell } from './numbers'

/** One peer as read from a company's Screener peer table. */
export interface ScrapedPeer {
  readonly symbol: string
  readonly name: string
  readonly marketCapCrore: Reported<Crore>
  /**
   * Values for the KPIs whose columns the table actually provided this scrape.
   * A KPI absent from the table is simply absent here and becomes `null`
   * downstream — the mapping never fabricates a value.
   */
  readonly kpis: Partial<Record<KpiId, Reported<number>>>
}

/** KPI render order, matching src/config/kpis.ts. */
const KPI_ORDER: readonly KpiId[] = [
  'revenue-growth',
  'operating-margin',
  'net-profit-margin',
  'return-on-equity',
  'return-on-capital-employed',
  'debt-to-equity',
]

/**
 * Header → KPI matchers, run against each normalised column header to discover
 * which of our KPIs a peer table exposes. Matched against `\b`-bounded acronyms
 * so `roce` never also matches `roe`. Quarterly-variation columns (`Qtr Sales
 * Var %`, `Qtr Profit Var %`) are deliberately **not** mapped to the annual
 * growth/margin KPIs. Extend this list to carry more KPIs as Screener exposes
 * them.
 */
const KPI_COLUMN_MATCHERS: readonly { readonly kpiId: KpiId; readonly test: (header: string) => boolean }[] = [
  { kpiId: 'return-on-capital-employed', test: (h) => /\broce\b/.test(h) },
  { kpiId: 'return-on-equity', test: (h) => /\broe\b/.test(h) || h.includes('return on equity') },
  {
    kpiId: 'operating-margin',
    test: (h) => /\bopm\b/.test(h) || h.includes('operating margin') || h.includes('operating profit margin'),
  },
  {
    kpiId: 'net-profit-margin',
    test: (h) => /\bnpm\b/.test(h) || h.includes('net profit margin') || h.includes('net margin'),
  },
  { kpiId: 'debt-to-equity', test: (h) => h.includes('debt') && /\beq/.test(h) },
  {
    // Annual sales/revenue growth only — never the quarterly-variation columns.
    kpiId: 'revenue-growth',
    test: (h) =>
      (h.includes('sales') || h.includes('revenue')) &&
      h.includes('growth') &&
      !h.includes('qtr') &&
      !h.includes('quarter'),
  },
]

function normalize(header: string): string {
  return header.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** The outcome of mapping one peer table: the peers plus what was detected. */
export interface MappedPeers {
  readonly peers: ScrapedPeer[]
  /** KPIs a column was found for, in `KPI_ORDER` — for logging/observability. */
  readonly mappedKpis: readonly KpiId[]
  readonly hasMarketCap: boolean
  /** Raw headers exactly as the page presented them, for logging. */
  readonly headers: readonly string[]
}

/**
 * Map one company's raw peer table into `ScrapedPeer`s, detecting whichever of
 * our KPIs its columns provide.
 *
 * Never throws for missing columns — that was the old ROCE-specific bug. A KPI
 * with no column is left unset (→ `null` downstream); a table with no market-cap
 * column yields peers with `marketCapCrore: null` that assembly drops rather
 * than fabricates. Only genuinely unreadable tables (handled by the caller when
 * `extractPeersTable` returns `null`) are treated as an error.
 */
export function mapPeersTable(table: RawPeerTable): MappedPeers {
  const headers = table.headers.map(normalize)
  const capIndex = headers.findIndex((h) => h.includes('mar cap') || h.includes('market cap'))

  const kpiColumn = new Map<KpiId, number>()
  for (const { kpiId, test } of KPI_COLUMN_MATCHERS) {
    if (kpiColumn.has(kpiId)) continue
    const index = headers.findIndex((header) => test(header))
    if (index !== -1) kpiColumn.set(kpiId, index)
  }

  const peers: ScrapedPeer[] = []
  for (const row of table.rows) {
    if (row.symbol === null) continue // a non-company row (spacer/total) — skip
    const kpis: Partial<Record<KpiId, Reported<number>>> = {}
    for (const [kpiId, index] of kpiColumn) kpis[kpiId] = parseCell(row.cells[index] ?? '')
    peers.push({
      symbol: row.symbol,
      name: row.name,
      marketCapCrore: capIndex === -1 ? null : parseCell(row.cells[capIndex] ?? ''),
      kpis,
    })
  }

  return {
    peers,
    mappedKpis: KPI_ORDER.filter((kpiId) => kpiColumn.has(kpiId)),
    hasMarketCap: capIndex !== -1,
    headers: table.headers,
  }
}

function toPeerCompany(peer: ScrapedPeer): PeerCompany {
  const kpis: PeerKpiSnapshot[] = KPI_ORDER.map((kpiId) => ({
    kpiId,
    value: peer.kpis[kpiId] ?? null,
  }))
  // marketCapCrore is guaranteed non-null by the caller's filter.
  return {
    id: peer.symbol.toLowerCase(),
    name: peer.name,
    ticker: peer.symbol,
    marketCapCrore: peer.marketCapCrore as number,
    kpis,
  }
}

/**
 * Assemble `PeerGroup`s from the peers scraped this run.
 *
 * For each group with at least one scraped member, the carried peers are the
 * union of those members' peer tables, deduped by symbol, excluding any tracked
 * company (those are derived members) and any peer without a market cap (which
 * the `PeerCompany` shape requires — skipped rather than fabricated).
 */
export function assemblePeerGroups(
  config: readonly PeerGroupConfig[],
  scrapedPeersByCompany: ReadonlyMap<string, readonly ScrapedPeer[]>,
  trackedSymbols: ReadonlySet<string>,
): PeerGroup[] {
  const groups: PeerGroup[] = []

  for (const group of config) {
    const scrapedMembers = group.memberCompanyIds.filter((id) => scrapedPeersByCompany.has(id))
    if (scrapedMembers.length === 0) continue

    const seen = new Set<string>()
    const peers: PeerCompany[] = []
    for (const memberId of scrapedMembers) {
      for (const peer of scrapedPeersByCompany.get(memberId) ?? []) {
        const key = peer.symbol.toUpperCase()
        if (trackedSymbols.has(key)) continue // a tracked company → derived, not carried
        if (seen.has(key)) continue
        if (peer.marketCapCrore === null) continue // required by PeerCompany; don't fabricate
        seen.add(key)
        peers.push(toPeerCompany(peer))
      }
    }

    groups.push({
      id: group.id,
      label: group.label,
      sector: group.sector,
      memberCompanyIds: group.memberCompanyIds,
      peers,
    })
  }

  return groups
}
