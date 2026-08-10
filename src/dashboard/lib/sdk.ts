/**
 * Munshot Dashboard SDK binding.
 *
 * The host loads the SDK script (see index.html) which installs
 * `window.MunshotDashboardSDK = { createClient, Client, namespace, version }`.
 * `createClient({ dashboardId })` returns a client that bridges postMessage to
 * the host iframe: `getContext()`, `onMessage()`, `onRequest()`, `ready()`,
 * `publish()`, `request()`.
 *
 * This module is the single place that touches the global, so every other file
 * imports a typed `sdk` and never reaches into `window`. When the SDK global is
 * absent — local `npm run dev`, outside the Munshot iframe — a dev shim stands
 * in: it synthesises a context from a `?ticker=` query param so the dashboard
 * renders real on-disk data without a host. The shim is gated to DEV.
 */

export interface HostSession {
  token: string | null
  userName: string | null
  email: string | null
  orgId: string | null
  orgName: string | null
}

export interface HostMarket {
  selectedTicker: string | null
  selectedTickerCompany: string | null
  selectedTickerCountry: string | null
  selectedSymbol: string | null
}

export interface HostContext {
  session: HostSession
  market: HostMarket
}

/** The subset of the Munshot client this dashboard uses. */
export interface DashboardClient {
  getContext(): Partial<HostContext> | null
  onMessage(handler: (message: unknown) => void): () => void
  onRequest(topic: string, handler: (data: unknown) => unknown | Promise<unknown>): () => void
  ready(): void
  publish(topic: string, data?: unknown, metadata?: unknown): void
}

interface MunshotGlobal {
  createClient(options: {
    dashboardId: string
    dashboardName?: string
    version?: string
    autoReady?: boolean
  }): DashboardClient
}

const DASHBOARD_ID = 'dhamma-earnings-dashboard'
const DASHBOARD_NAME = 'Dhamma Capital · Earnings'
const DASHBOARD_VERSION = '0.1.0'

function readGlobal(): MunshotGlobal | null {
  if (typeof window === 'undefined') return null
  const g = (window as unknown as { MunshotDashboardSDK?: MunshotGlobal }).MunshotDashboardSDK
  return g && typeof g.createClient === 'function' ? g : null
}

/**
 * Dev shim: no host, so read the ticker from `?ticker=SYMBOL` (defaulting to a
 * real on-disk company) and hand back a context. The token is a non-null
 * placeholder only so widgets pass their "waiting for session" gate while
 * developing; the dev data path reads local JSON, not an authenticated API, so
 * no real credential is involved or invented here.
 */
function createDevShim(): DashboardClient {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const ticker = (params.get('ticker') || 'RELIANCE').trim().toUpperCase()
  const context: HostContext = {
    session: { token: 'dev-session', userName: 'Dev', email: null, orgId: null, orgName: 'Dhamma Capital' },
    market: {
      selectedTicker: ticker,
      selectedTickerCompany: null,
      selectedTickerCountry: 'IN',
      selectedSymbol: `NSE:${ticker}`,
    },
  }
  const requestHandlers = new Map<string, (data: unknown) => unknown | Promise<unknown>>()
  return {
    getContext: () => context,
    onMessage: () => () => undefined,
    onRequest: (topic, handler) => {
      requestHandlers.set(topic, handler)
      return () => requestHandlers.delete(topic)
    },
    ready: () => undefined,
    publish: () => undefined,
  }
}

function createClient(): DashboardClient {
  // Local dev has no Munshot host to hand-shake with, so the shim (real on-disk
  // data via ?ticker=) takes priority there. Production always binds the host.
  if (import.meta.env.DEV) return createDevShim()
  const g = readGlobal()
  if (g) {
    return g.createClient({
      dashboardId: DASHBOARD_ID,
      dashboardName: DASHBOARD_NAME,
      version: DASHBOARD_VERSION,
      autoReady: false,
    })
  }
  // Embedded but the SDK script failed to load: a minimal inert client so the
  // app still boots and shows its waiting/empty states instead of crashing.
  return {
    getContext: () => null,
    onMessage: () => () => undefined,
    onRequest: () => () => undefined,
    ready: () => undefined,
    publish: () => undefined,
  }
}

export const sdk: DashboardClient = createClient()

/** True when a real Munshot host is present (not the dev shim / inert client). */
export const hasHost = readGlobal() !== null
