/**
 * The single data seam.
 *
 * Every widget reads financials through `useFinancials(ticker)` and nothing
 * else. The host's selected ticker IS the NSE symbol, which is also our
 * `CompanyFinancials.companyId` — so there is no symbol↔id mapping.
 *
 * ── Where the real numbers come from ──
 * Today this resolves the company's already-scraped Screener statements from
 * `data/<SYMBOL>.json` (real figures, validated at load). A ticker with no file
 * yet resolves to `null`, which every widget renders as an honest "awaiting
 * data" state — never invented numbers.
 *
 * When a Munshot fundamentals datasource is confirmed, `fetchFinancials` is the
 * one place to swap: call it with the host bearer token and adapt the response
 * into `CompanyFinancials`. The widgets do not change.
 */

import { useEffect, useState } from 'react'
import { getScrapedFinancials } from '@/data/scrapedFinancials'
import type { CompanyFinancials } from '@/types/financials'

export type FinancialsResult =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; error: string }
  | { status: 'ok'; data: CompanyFinancials }

/**
 * Resolve one company's financials by NSE symbol. Async on purpose: it mirrors
 * the shape of a real host API call and lets widgets exercise their loading
 * state honestly.
 */
export async function fetchFinancials(ticker: string): Promise<CompanyFinancials | null> {
  const symbol = ticker.trim().toUpperCase()
  // Real, on-disk scraped statements. Swap this line for the Munshot
  // fundamentals call (with the host token) once that datasource exists.
  return getScrapedFinancials(symbol)
}

/** React binding: re-fetches whenever the ticker (or session token) changes. */
export function useFinancials(ticker: string | null, token: string | null): FinancialsResult {
  const [result, setResult] = useState<FinancialsResult>(
    ticker ? { status: 'loading' } : { status: 'empty' },
  )

  useEffect(() => {
    if (!ticker) {
      setResult({ status: 'empty' })
      return
    }
    let live = true
    setResult({ status: 'loading' })
    fetchFinancials(ticker)
      .then((data) => {
        if (!live) return
        setResult(data ? { status: 'ok', data } : { status: 'empty' })
      })
      .catch((err: unknown) => {
        if (!live) return
        setResult({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' })
      })
    return () => {
      live = false
    }
    // token is intentionally a dependency: a session refresh must re-fetch.
  }, [ticker, token])

  return result
}
