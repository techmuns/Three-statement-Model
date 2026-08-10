/**
 * The one authoritative hook for host context.
 *
 * Every widget reads session token + selected ticker from here, never from the
 * SDK directly, so a session refresh or a ticker change re-renders the whole
 * dashboard from a single subscription. Mirrors the Munshot auth-standards hook.
 */

import { useEffect, useState } from 'react'
import { sdk, type HostSession } from './sdk'

const EMPTY_SESSION: HostSession = {
  token: null,
  userName: null,
  email: null,
  orgId: null,
  orgName: null,
}

export interface HostContextValue {
  session: HostSession
  ticker: string | null
  tickerCompany: string | null
  tickerCountry: string | null
  selectedSymbol: string | null
}

export function useHostContext(): HostContextValue {
  const [value, setValue] = useState<HostContextValue>({
    session: EMPTY_SESSION,
    ticker: null,
    tickerCompany: null,
    tickerCountry: null,
    selectedSymbol: null,
  })

  useEffect(() => {
    const sync = () => {
      const ctx = sdk.getContext()
      if (!ctx) return
      setValue({
        session: { ...EMPTY_SESSION, ...(ctx.session ?? {}) },
        ticker: ctx.market?.selectedTicker ?? null,
        tickerCompany: ctx.market?.selectedTickerCompany ?? null,
        tickerCountry: ctx.market?.selectedTickerCountry ?? null,
        selectedSymbol: ctx.market?.selectedSymbol ?? null,
      })
    }
    sync()
    const unsubscribe = sdk.onMessage(sync)
    // Signal readiness after the first subscription so the host flushes any
    // context queued before we mounted.
    sdk.ready()
    return unsubscribe
  }, [])

  return value
}
