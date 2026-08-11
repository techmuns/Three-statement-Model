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

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CompanyFinancials, PeerRef } from '@/types/financials'
import type { KpiId } from '@/types/kpi'
import type { Reported } from '@/types/common'
import { deriveKpis } from './metrics'
import { fetchFinancials, requestAnalyzeMany } from './financials'
import { peerGroupFor } from './peers'

const DEV = import.meta.env.DEV
/** How often to re-check whether a dispatched peer's data has landed. */
const PEER_POLL_MS = 15_000
/** Give up polling a peer after this long (the scrape may still finish later). */
const PEER_TIMEOUT_MS = 8 * 60_000

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

/** Re-derive a peer's row from freshly scraped statements (absent → derived). */
function derivedRow(prev: PeerRow, data: CompanyFinancials): PeerRow {
  return { ...prev, origin: 'derived', kpis: latestKpiMap(data) }
}

export interface PeerComparison {
  /** Subject first, then peers (derived, then carried, then not-yet-analyzed). */
  rows: PeerRow[]
  /** The initial peer build is in flight. */
  loading: boolean
  /** Peer symbols with a scrape in flight right now (show a spinner). */
  analyzing: ReadonlySet<string>
  /** Peers not yet backed by full statements — what "Run all" targets. */
  runnable: string[]
  /** A dispatch/batch problem to surface, else null. */
  message: string | null
  /** False in local dev — Analyze only runs on the deployed dashboard. */
  canAnalyze: boolean
  /** Analyze every not-yet-analyzed peer, in one run. */
  runAll: () => void
  /** Analyze a single peer. */
  runPeer: (symbol: string) => void
}

/**
 * The peer comparison plus the ability to fill it in: "Run all" dispatches a
 * single scrape of every not-yet-analyzed peer, then polls and upgrades each
 * row in place (— → real KPIs) as its data lands. Pure row-building still lives
 * in `buildPeerRows`, reused by the Excel export.
 */
export function usePeerComparison(
  subject: CompanyFinancials,
  subjectName: string,
): PeerComparison {
  const [rows, setRows] = useState<PeerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)

  const liveRef = useRef(true)
  const pendingRef = useRef<Map<string, number>>(new Map()) // symbol → poll deadline (ms)
  const pollRef = useRef<number | null>(null)

  const stopPolling = () => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  // Build (and rebuild) the comparison whenever the subject changes.
  useEffect(() => {
    liveRef.current = true
    setLoading(true)
    setAnalyzing(new Set())
    setMessage(null)
    pendingRef.current.clear()
    stopPolling()

    buildPeerRows(subject, subjectName).then((built) => {
      if (!liveRef.current) return
      setRows(built)
      setLoading(false)
    })

    return () => {
      liveRef.current = false
      stopPolling()
    }
  }, [subject, subjectName])

  // One interval polls every pending peer; each lands (or times out) on its own.
  const ensurePolling = useCallback(() => {
    if (pollRef.current !== null) return
    pollRef.current = window.setInterval(() => {
      if (!liveRef.current) return stopPolling()
      const pending = [...pendingRef.current.keys()]
      if (pending.length === 0) {
        stopPolling()
        return
      }
      pending.forEach((symbol) => {
        const deadline = pendingRef.current.get(symbol)
        fetchFinancials(symbol)
          .then((data) => {
            if (!liveRef.current) return
            if (data) {
              pendingRef.current.delete(symbol)
              setRows((prev) => prev.map((r) => (r.symbol === symbol ? derivedRow(r, data) : r)))
              setAnalyzing((prev) => {
                const next = new Set(prev)
                next.delete(symbol)
                return next
              })
            } else if (deadline !== undefined && Date.now() > deadline) {
              pendingRef.current.delete(symbol)
              setAnalyzing((prev) => {
                const next = new Set(prev)
                next.delete(symbol)
                return next
              })
              setMessage('Some peers are still scraping — try again in a minute.')
            }
          })
          .catch(() => {
            /* transient during polling — keep trying until the deadline */
          })
      })
    }, PEER_POLL_MS)
  }, [])

  const runMany = useCallback(
    (symbols: string[]) => {
      const targets = [...new Set(symbols.filter(Boolean))]
      if (targets.length === 0 || DEV) return
      setMessage(null)
      setAnalyzing((prev) => new Set([...prev, ...targets]))

      requestAnalyzeMany(targets)
        .then((res) => {
          if (!liveRef.current) return
          if (!res.ok) {
            setMessage(res.message ?? 'Couldn’t start analysis.')
            setAnalyzing((prev) => {
              const next = new Set(prev)
              targets.forEach((s) => next.delete(s))
              return next
            })
            return
          }
          const deadline = Date.now() + PEER_TIMEOUT_MS
          targets.forEach((s) => pendingRef.current.set(s, deadline))
          ensurePolling()
        })
        .catch((err: unknown) => {
          if (!liveRef.current) return
          setMessage(err instanceof Error ? err.message : 'Couldn’t start analysis.')
          setAnalyzing((prev) => {
            const next = new Set(prev)
            targets.forEach((s) => next.delete(s))
            return next
          })
        })
    },
    [ensurePolling],
  )

  const runnable = rows.filter((r) => !r.isSubject && r.origin !== 'derived').map((r) => r.symbol)

  return {
    rows,
    loading,
    analyzing,
    runnable,
    message,
    canAnalyze: !DEV,
    runAll: () => runMany(runnable),
    runPeer: (symbol) => runMany([symbol]),
  }
}
