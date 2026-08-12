/**
 * Dhamma Capital · Earnings Dashboard (standalone).
 *
 * Self-contained: the company is chosen with the header search (or a `?ticker=`
 * URL param), its statements are resolved at runtime from the Worker, and if
 * nothing is scraped yet it offers Analyze — which dispatches a scrape and then
 * fills itself in. Every missing case has an honest state; nothing is faked.
 */

import { useState, type ReactNode } from 'react'
import { DEFAULT_PERIOD_VIEW, type PeriodViewId } from '@/config/navigation'
import { useCompanyData } from './data/useCompanyData'
import { useAnalyzedCompanies } from './data/useAnalyzedCompanies'
import { companyName as registryName } from './data/companySearch'
import { downloadDashboardPng } from './lib/capture'
import { exportDashboardPdf } from './lib/exportPdf'
import { exportFinancialsXlsx } from './lib/exportExcel'
import { Shell, Footer } from './ui/Shell'
import { Header, type DashboardTabId } from './ui/Header'
import { EmptyState, ErrorState, LoadingState } from './ui/states'
import { AnalyzePrompt, AnalyzingState } from './components/AnalyzePanel'
import { FinancialsTab } from './tabs/FinancialsTab'
import { KpisTab } from './tabs/KpisTab'
import { T } from './ui/tokens'

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function FullState({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 440, width: '100%' }}>{children}</div>
    </div>
  )
}

/** Seed the company from `?ticker=` so the view is shareable and deep-linkable. */
function initialTicker(): string | null {
  if (typeof window === 'undefined') return null
  const t = new URLSearchParams(window.location.search).get('ticker')
  return t ? t.trim().toUpperCase() : null
}

export default function EarningsDashboard() {
  const [ticker, setTicker] = useState<string | null>(initialTicker)
  const [tab, setTab] = useState<DashboardTabId>('financials')
  const [period, setPeriod] = useState<PeriodViewId>(DEFAULT_PERIOD_VIEW)
  const { phase, data, message, analyze } = useCompanyData(ticker)
  // Refresh the instant-open list whenever a company finishes loading (a newly
  // analyzed one should appear without a manual reload).
  const analyzed = useAnalyzedCompanies(phase === 'ready' ? ticker : 'init')

  const selectCompany = (symbol: string) => {
    const sym = symbol.trim().toUpperCase()
    setTicker(sym)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('ticker', sym)
      window.history.replaceState(null, '', url.toString())
    }
  }

  const companyName = ticker ? registryName(ticker) ?? data?.companyId ?? ticker : null
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
          message="Search a company to begin"
          hint="Type a name or ticker in the search box above — e.g. RELIANCE, TCS, SHAILY. Any listed company works."
        />
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
          currentSymbol={ticker}
          currentName={companyName}
          onSelectCompany={selectCompany}
          analyzed={analyzed}
          tab={tab}
          onTabChange={setTab}
          period={period}
          onPeriodChange={setPeriod}
          onExportExcel={onExportExcel}
          onExportPdf={onExportPdf}
          onExportPng={onExportPng}
          onFindPeers={phase === 'ready' && data ? () => setTab('kpis') : undefined}
        />
      }
      footer={footer}
    >
      {body}
    </Shell>
  )
}
