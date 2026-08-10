/**
 * Real peer comparison.
 *
 * A peer's KPIs are derived from *its own* scraped statements — the same
 * `deriveKpis` the subject uses — so all six KPIs compare on equal footing, not
 * just the single ROCE column Screener's peer table exposes. Peers we have data
 * for are `derived` (full KPIs); a peer only present in the carried snapshot is
 * `carried` (whatever that snapshot held); one we can't resolve is `absent`.
 *
 * The peer list comes from the subject's own stored `peers` (Screener's peer
 * table, captured per company) when present, else the sector peer group — so it
 * works for any company once scraped, and for the seeded sectors today.
 */

import { useEffect, useState } from 'react'
import type { CompanyFinancials, PeerRef } from '@/types/financials'
import type { KpiId } from '@/types/kpi'
import type { Reported } from '@/types/common'
import { deriveKpis } from './metrics'
import { fetchFinancials } from './financials'
import { peerGroupFor } from './peers'

export type PeerOrigin = 'derived' | 'carried' | 'absent'

export interface PeerRow {
  symbol: string
  name: string
  isSubject: boolean
  origin: PeerOrigin
  marketCap: Reported<number>
  kpis: Map<KpiId, Reported<number>>
}

/** Latest-year value of every KPI, derived from a company's own statements. */
function latestKpiMap(financials: CompanyFinancials): Map<KpiId, Reported<number>> {
  return new Map(deriveKpis(financials.annual).map((kpi) => [kpi.id, kpi.latest]))
}

interface Candidate {
  symbol: string
  name: string
  carriedMarketCap: Reported<number>
  carriedKpis: Map<KpiId, Reported<number>> | null
}

/** Peer candidates for a subject: its stored peers, else its sector cohort. */
function candidatesFor(subject: CompanyFinancials): Candidate[] {
  const subjectId = subject.companyId.toUpperCase()
  const seen = new Set([subjectId])
  const out: Candidate[] = []

  const add = (symbol: string, name: string, mcap: Reported<number>, kpis: Map<KpiId, Reported<number>> | null) => {
    const key = symbol.toUpperCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push({ symbol: key, name, carriedMarketCap: mcap, carriedKpis: kpis })
  }

  if (subject.peers && subject.peers.length > 0) {
    subject.peers.forEach((p: PeerRef) => add(p.symbol, p.name, p.marketCapCrore ?? null, null))
    return out
  }

  const group = peerGroupFor(subject.companyId)
  if (!group) return out
  group.memberCompanyIds.forEach((id) => add(id, id, null, null))
  group.peers.forEach((p) =>
    add(p.ticker, p.name, p.marketCapCrore ?? null, new Map(p.kpis.map((k) => [k.kpiId, k.value]))),
  )
  return out
}

const ORDER: Record<PeerOrigin, number> = { derived: 0, carried: 1, absent: 2 }

/**
 * Build the peer-comparison rows for a subject (subject first, then peers).
 * Pure and async — reused by the hook and by the Excel export. Fetches each
 * peer's statements and derives its KPIs; falls back to the carried snapshot,
 * then to an absent row.
 */
export async function buildPeerRows(
  subject: CompanyFinancials,
  subjectName: string,
): Promise<PeerRow[]> {
  const subjectRow: PeerRow = {
    symbol: subject.companyId.toUpperCase(),
    name: subjectName,
    isSubject: true,
    origin: 'derived',
    marketCap: null,
    kpis: latestKpiMap(subject),
  }

  const candidates = candidatesFor(subject)
  if (candidates.length === 0) return [subjectRow]

  const peerRows = await Promise.all(
    candidates.map(async (c): Promise<PeerRow> => {
      let data: CompanyFinancials | null = null
      try {
        data = await fetchFinancials(c.symbol)
      } catch {
        data = null
      }
      if (data) {
        return { symbol: c.symbol, name: c.name, isSubject: false, origin: 'derived', marketCap: c.carriedMarketCap, kpis: latestKpiMap(data) }
      }
      if (c.carriedKpis) {
        return { symbol: c.symbol, name: c.name, isSubject: false, origin: 'carried', marketCap: c.carriedMarketCap, kpis: c.carriedKpis }
      }
      return { symbol: c.symbol, name: c.name, isSubject: false, origin: 'absent', marketCap: c.carriedMarketCap, kpis: new Map() }
    }),
  )
  peerRows.sort((a, b) => ORDER[a.origin] - ORDER[b.origin] || (b.marketCap ?? 0) - (a.marketCap ?? 0))
  return [subjectRow, ...peerRows]
}

export function usePeerKpis(
  subject: CompanyFinancials,
  subjectName: string,
): { rows: PeerRow[]; loading: boolean } {
  const [rows, setRows] = useState<PeerRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    setLoading(true)
    buildPeerRows(subject, subjectName).then((built) => {
      if (!live) return
      setRows(built)
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [subject, subjectName])

  return { rows, loading }
}
