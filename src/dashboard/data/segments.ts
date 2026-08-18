/**
 * Revenue mix by segment, sourced from the Concall Deep Dive app.
 *
 * That app's per-company report carries a fact-checked `about.revenue_mix`
 * (`[{segment, pct}]` — the split management stated on the latest earnings call,
 * verified against the transcript). It's the segment source that sidesteps BSE's
 * IP block. In production we go through our own Worker (`/api/segments`, which
 * proxies + extracts); in local dev we hit the concall app directly (its API
 * sends `Access-Control-Allow-Origin: *`). A miss returns `null` and the card
 * stays an honest "not reported" — never faked.
 */

const DEV = import.meta.env.DEV
const CONCALL_BASE = 'https://concall-sattva.tech-441.workers.dev'

export interface ConcallSegments {
  /** The call this mix was stated on, e.g. "Q1FY27" (null if unknown). */
  readonly quarter: string | null
  readonly segments: readonly { readonly name: string; readonly pct: number }[]
}

/** Byte-identical to the concall app's slugify (dev direct-fetch path only). */
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'company'
  )
}

interface RawMix {
  segment?: unknown
  pct?: unknown
}

function cleanMix(raw: unknown): { name: string; pct: number }[] {
  if (!Array.isArray(raw)) return []
  return (raw as RawMix[])
    .filter((m) => m && typeof m.pct === 'number' && typeof m.segment === 'string' && m.segment.trim())
    .map((m) => ({ name: String(m.segment), pct: m.pct as number }))
}

export async function fetchConcallSegments(ticker: string): Promise<ConcallSegments | null> {
  const sym = ticker.trim().toUpperCase()
  if (!sym) return null

  try {
    if (DEV) {
      const res = await fetch(`${CONCALL_BASE}/api/report?slug=${encodeURIComponent(slugify(sym))}`, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return null
      const d = (await res.json()) as { status?: string; report?: { about?: { revenue_mix?: unknown }; meta?: { quarter?: string } } }
      const segments = cleanMix(d.report?.about?.revenue_mix)
      if (d.status !== 'done' || segments.length === 0) return null
      return { quarter: d.report?.meta?.quarter ?? null, segments }
    }

    const res = await fetch(`/api/segments?ticker=${encodeURIComponent(sym)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const p = (await res.json()) as { status?: string; quarter?: string | null; segments?: unknown }
    const segments = cleanMix(p.segments)
    if (p.status !== 'available' || segments.length === 0) return null
    return { quarter: p.quarter ?? null, segments }
  } catch {
    return null
  }
}
