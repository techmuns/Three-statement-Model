/**
 * The single data seam.
 *
 * The host's selected ticker IS the NSE symbol, which is also our
 * `CompanyFinancials.companyId` — so there is no symbol↔id mapping.
 *
 * ── Where the real numbers come from ──
 * In production the dashboard reads the company's already-scraped statements at
 * runtime from the Worker (`GET /api/financials`), which serves the committed
 * `data/<SYMBOL>.json` fresh from the repo. A 404 means "not scraped yet" →
 * `null`, which the UI turns into an Analyze prompt (never invented numbers).
 *
 * In local dev there is no Worker, so it reads the same real files straight off
 * disk via the build-time glob — so `npm run dev` still renders real data.
 */

import type { CompanyFinancials } from '@/types/financials'

const DEV = import.meta.env.DEV

/** Resolve one company's financials by NSE symbol; `null` when not scraped yet. */
export async function fetchFinancials(ticker: string): Promise<CompanyFinancials | null> {
  const symbol = ticker.trim().toUpperCase()

  if (DEV) {
    // Real on-disk scraped data, no Worker needed. Dynamic import so the build
    // does not inline every data file into the production bundle.
    const mod = await import('@/data/scrapedFinancials')
    return mod.getScrapedFinancials(symbol)
  }

  const res = await fetch(`/api/financials?ticker=${encodeURIComponent(symbol)}`, {
    headers: { Accept: 'application/json' },
  })
  if (res.status === 404) return null // not scraped yet
  if (!res.ok) throw new Error(`financials request failed (${res.status})`)
  const payload = (await res.json()) as { status?: string; data?: CompanyFinancials }
  return payload.data ?? null
}

export interface AnalyzeResult {
  ok: boolean
  message?: string
}

/** Ask the Worker to dispatch a scrape of one company. */
export async function requestAnalyze(ticker: string): Promise<AnalyzeResult> {
  const symbol = ticker.trim().toUpperCase()

  if (DEV) {
    return { ok: false, message: 'Analyze runs on the deployed dashboard, not in local dev.' }
  }

  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker: symbol }),
  })
  const payload = (await res.json().catch(() => ({}))) as { status?: string; message?: string }
  if (res.ok && payload.status === 'dispatched') return { ok: true }
  return { ok: false, message: payload.message ?? `Couldn’t start analysis (${res.status}).` }
}
