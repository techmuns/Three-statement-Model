/**
 * Dhamma Capital · Earnings Dashboard (Munshot embedded).
 *
 * The dashboard is the first and only screen — no landing page. It reads the
 * selected ticker and session from the Munshot host, resolves that company's
 * real statements through the data seam, and renders the Financials and KPIs
 * tabs. Every missing case (no ticker, no session yet, no data, load error) has
 * an honest state; nothing is faked.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_PERIOD_VIEW, type PeriodViewId } from '@/config/navigation'
import { useHostContext } from './lib/hostContext'
import { useFinancials } from './data/financials'
import { downloadDashboardPng, registerVisualCapture } from './lib/capture'
import { Shell, Footer } from './ui/Shell'
import { Header, type DashboardTabId } from './ui/Header'
import { EmptyState, ErrorState, LoadingState, WaitingForSession } from './ui/states'
import { FinancialsTab } from './tabs/FinancialsTab'
import { KpisTab } from './tabs/KpisTab'
import { T } from './ui/tokens'

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Centre a state message in the scroll area. */
function FullState({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 420, width: '100%' }}>{children}</div>
    </div>
  )
}

export default function EarningsDashboard() {
  const { session, ticker, tickerCompany } = useHostContext()
  const [tab, setTab] = useState<DashboardTabId>('financials')
  const [period, setPeriod] = useState<PeriodViewId>(DEFAULT_PERIOD_VIEW)
  const result = useFinancials(ticker, session.token)

  useEffect(() => {
    registerVisualCapture()
  }, [])

  const companyName = tickerCompany ?? (result.status === 'ok' ? result.data.companyId : ticker) ?? null

  const handleExport = () => downloadDashboardPng(`${ticker ?? 'dashboard'}-${tab}`)

  let body: ReactNode
  if (!ticker) {
    body = (
      <FullState>
        <EmptyState
          message="No company selected"
          hint="Pick a stock in Munshot to load its P&L, balance sheet, cash flow and KPIs."
        />
      </FullState>
    )
  } else if (!session.token) {
    body = (
      <FullState>
        <WaitingForSession />
      </FullState>
    )
  } else if (result.status === 'loading') {
    body = (
      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))' }}>
        {[0, 1].map((i) => (
          <div key={i} style={{ background: T.cardBg, border: `1px solid ${T.borderDefault}`, borderRadius: 16 }}>
            <LoadingState rows={7} />
          </div>
        ))}
      </div>
    )
  } else if (result.status === 'error') {
    body = (
      <FullState>
        <ErrorState hint={result.error} />
      </FullState>
    )
  } else if (result.status === 'empty') {
    body = (
      <FullState>
        <EmptyState
          message={`No statements for ${ticker} yet`}
          hint="This company isn’t in the scraped set yet. It will appear here once its Screener data is ingested — no placeholder numbers are shown in the meantime."
        />
      </FullState>
    )
  } else {
    body =
      tab === 'financials' ? (
        <FinancialsTab financials={result.data} period={period} />
      ) : (
        <KpisTab financials={result.data} companyName={companyName ?? result.data.companyId} period={period} />
      )
  }

  const footer =
    result.status === 'ok' ? (
      <Footer>
        <span>
          Source: Screener.in · {result.data.source.basis} · updated {shortDate(result.data.source.fetchedAt)}
        </span>
        <span style={{ marginLeft: 'auto' }}>Figures in ₹ crore · “—” = not reported</span>
      </Footer>
    ) : (
      <Footer>
        <span>Source: Screener.in — real scraped statements, honest empty states where a company isn’t covered yet.</span>
      </Footer>
    )

  return (
    <Shell
      header={
        <Header
          ticker={ticker}
          company={companyName}
          tab={tab}
          onTabChange={setTab}
          period={period}
          onPeriodChange={setPeriod}
          onExport={handleExport}
        />
      }
      footer={footer}
    >
      {body}
    </Shell>
  )
}
