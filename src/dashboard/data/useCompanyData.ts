/**
 * Owns a company's data lifecycle: load, and — when nothing is scraped yet —
 * Analyze (dispatch a scrape) then poll until the data lands.
 *
 * Phases:
 *   loading    → fetching the company's statements
 *   ready      → statements in hand (`data`)
 *   absent     → valid ticker, nothing scraped yet → offer Analyze
 *   analyzing  → a scrape was dispatched; polling for the committed result
 *   error      → the load or the dispatch failed (`message`)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CompanyFinancials } from '@/types/financials'
import { fetchFinancials, requestAnalyze } from './financials'

const POLL_INTERVAL_MS = 15_000
const POLL_TIMEOUT_MS = 6 * 60_000

export type CompanyPhase = 'loading' | 'ready' | 'absent' | 'analyzing' | 'error'

export interface CompanyDataState {
  phase: CompanyPhase
  data: CompanyFinancials | null
  message: string | null
  analyze: () => void
}

export function useCompanyData(ticker: string | null, token: string | null): CompanyDataState {
  const [phase, setPhase] = useState<CompanyPhase>('loading')
  const [data, setData] = useState<CompanyFinancials | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const liveRef = useRef(true)
  const pollRef = useRef<number | null>(null)

  const stopPolling = () => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  // Load (and reload whenever the ticker or session token changes).
  useEffect(() => {
    liveRef.current = true
    stopPolling()
    setMessage(null)

    if (!ticker) {
      setPhase('absent')
      setData(null)
      return
    }

    setPhase('loading')
    fetchFinancials(ticker)
      .then((result) => {
        if (!liveRef.current) return
        setData(result)
        setPhase(result ? 'ready' : 'absent')
      })
      .catch((err: unknown) => {
        if (!liveRef.current) return
        setPhase('error')
        setMessage(err instanceof Error ? err.message : 'Failed to load statements.')
      })

    return () => {
      liveRef.current = false
      stopPolling()
    }
  }, [ticker, token])

  const analyze = useCallback(() => {
    if (!ticker) return
    setMessage(null)
    setPhase('analyzing')

    requestAnalyze(ticker)
      .then((res) => {
        if (!liveRef.current) return
        if (!res.ok) {
          setPhase('error')
          setMessage(res.message ?? 'Couldn’t start analysis.')
          return
        }
        const startedAt = Date.now()
        stopPolling()
        pollRef.current = window.setInterval(() => {
          if (!liveRef.current) return stopPolling()
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            stopPolling()
            setPhase('absent')
            setMessage('Still working — the scrape may be running. Try Analyze again in a minute.')
            return
          }
          fetchFinancials(ticker)
            .then((result) => {
              if (!liveRef.current || !result) return
              stopPolling()
              setData(result)
              setPhase('ready')
            })
            .catch(() => {
              /* transient during polling — keep trying */
            })
        }, POLL_INTERVAL_MS)
      })
      .catch((err: unknown) => {
        if (!liveRef.current) return
        setPhase('error')
        setMessage(err instanceof Error ? err.message : 'Couldn’t start analysis.')
      })
  }, [ticker])

  return { phase, data, message, analyze }
}
