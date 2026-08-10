/**
 * Dhamma Capital · Earnings Dashboard (Munshot embedded).
 *
 * The dashboard is the first and only screen. It reads the selected ticker and
 * session from the Munshot host and resolves that company's statements at
 * runtime. If nothing is scraped yet, it offers Analyze — which dispatches a
 * scrape and then fills itself in. Every missing case has an honest state;
 * nothing is faked.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_PERIOD_VIEW, type PeriodViewId } from '@/config/navigation'
import { useHostContext } from './lib/hostContext'
import { useCompanyData } from './data/useCompanyData'
import { downloadDashboardPng, registerVisualCapture } from './lib/capture'
import { exportDashboardPdf } from './lib/exportPdf'
import { exportFinancialsXlsx } from './lib/exportExcel'
import { Shell, Footer } from './ui/Shell'
import { Header, type DashboardTabId } from './ui/Header'
import { EmptyState, ErrorState, LoadingState, WaitingForSession } from './ui/states'
import { AnalyzePrompt, AnalyzingState } from './components/AnalyzePanel'
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
      <div style={{ maxWidth: 440, width: '100%' }}>{children}</div>
    </div>
  )
}

export default function EarningsDashboard() {
  const { session, ticker, tickerCompany } = useHostContext()
  const [tab, setTab] = useState<DashboardTabId>('financials')
  const [period, setPeriod] = useState<PeriodViewId>(DEFAULT_PERIOD_VIEW)
  const { phase, data, message, analyze } = useCompanyData(ticker, session.token)

  useEffect(() => {
    registerVisualCapture()
  }, [])

  const companyName = tickerCompany ?? data?.companyId ?? ticker ?? null
  const fileStem = `${ticker ?? 'dashboard'}-${tab}`
  const onExportPng = () => downloadDashboardPng(fileStem)
  const onExportPdf = () => exportDashboardPdf(fileStem)
  const onExportExcel =
    phase === 'ready' && data
      ? () => exportFinancialsXlsx(data, period, companyName ?? data.companyId)
      : null

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
  } else if (phase === 'loading') {
    body = (
      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))' }}>
        {[0, 1].map((i) => (
          <div key={i} style={{ background: T.cardBg, border: `1px solid ${T.borderDefault}`, borderRadius: 16 }}>
            <LoadingState rows={7} />
          </div>
        ))}
      </div>
    )
  } else if (phase === 'error') {
    body = (
      <FullState>
        <ErrorState hint={message ?? undefined} />
      </FullState>
    )
  } else if (phase === 'analyzing') {
    body = (
      <FullState>
        <AnalyzingState ticker={ticker} />
      </FullState>
    )
  } else if (phase === 'absent' || !data) {
    body = (
      <FullState>
        <AnalyzePrompt ticker={ticker} onAnalyze={analyze} />
        {message && (
          <p style={{ textAlign: 'center', fontSize: 12, color: T.inkHint, marginTop: 12 }}>{message}</p>
        )}
      </FullState>
    )
  } else {
    body =
      tab === 'financials' ? (
        <FinancialsTab financials={data} period={period} />
      ) : (
        <KpisTab financials={data} companyName={companyName ?? data.companyId} period={period} />
      )
  }

  const footer =
    phase === 'ready' && data ? (
      <Footer>
        <span>
          Source: Screener.in · {data.source.basis} · updated {shortDate(data.source.fetchedAt)}
        </span>
        <span style={{ marginLeft: 'auto' }}>Figures in ₹ crore · “—” = not reported</span>
      </Footer>
    ) : (
      <Footer>
        <span>Source: Screener.in — real scraped statements, on demand. Honest empty states where a company isn’t analyzed yet.</span>
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
          onExportExcel={onExportExcel}
          onExportPdf={onExportPdf}
          onExportPng={onExportPng}
        />
      }
      footer={footer}
    >
      {body}
    </Shell>
  )
}
