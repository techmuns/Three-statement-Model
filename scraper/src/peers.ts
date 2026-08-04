/**
 * Mapping Screener's peer-comparison table onto the peer schema.
 *
 * Screener's peer table is a current snapshot with these columns: S.No, Name,
 * CMP, P/E, Mar Cap, Div Yld, NP Qtr, Qtr Profit Var %, Sales Qtr, Qtr Sales
 * Var %, ROCE %. Of our six KPIs only **ROCE** is present, so that is the only
 * one carried; the other five are represented as `null` (unavailable) — never
 * guessed, never derived from unrelated columns (e.g. the quarterly variation
 * columns are not our annual revenue growth). Market cap maps to
 * `PeerCompany.marketCapCrore`.
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
  readonly roce: Reported<number>
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
 * The only one of our KPIs Screener's peer table provides. Adding a mapping
 * here (should Screener expose more columns) is all it takes to carry another.
 */
const PROVIDED_KPI: Partial<Record<KpiId, (peer: ScrapedPeer) => Reported<number>>> = {
  'return-on-capital-employed': (peer) => peer.roce,
}

function normalize(header: string): string {
  return header.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Map one company's raw peer table into `ScrapedPeer`s. Throws if the columns
 * we depend on aren't there — a loud signal that Screener changed the table. */
export function mapPeersTable(table: RawPeerTable, symbol: string): ScrapedPeer[] {
  const headers = table.headers.map(normalize)
  const roceIndex = headers.findIndex((header) => header.includes('roce'))
  const capIndex = headers.findIndex((header) => header.includes('mar cap') || header.includes('market cap'))
  if (roceIndex === -1) {
    throw new Error(`${symbol} · peers: ROCE column not found (headers: ${table.headers.join(' | ')})`)
  }
  if (capIndex === -1) {
    throw new Error(`${symbol} · peers: market-cap column not found (headers: ${table.headers.join(' | ')})`)
  }

  const peers: ScrapedPeer[] = []
  for (const row of table.rows) {
    if (row.symbol === null) continue // a non-company row (spacer/total) — skip
    peers.push({
      symbol: row.symbol,
      name: row.name,
      marketCapCrore: parseCell(row.cells[capIndex] ?? ''),
      roce: parseCell(row.cells[roceIndex] ?? ''),
    })
  }
  return peers
}

function toPeerCompany(peer: ScrapedPeer): PeerCompany {
  const kpis: PeerKpiSnapshot[] = KPI_ORDER.map((kpiId) => ({
    kpiId,
    value: PROVIDED_KPI[kpiId]?.(peer) ?? null,
  }))
  // marketCapCrore is guaranteed non-null by the caller's filter.
  return { id: peer.symbol.toLowerCase(), name: peer.name, ticker: peer.symbol, marketCapCrore: peer.marketCapCrore as number, kpis }
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
