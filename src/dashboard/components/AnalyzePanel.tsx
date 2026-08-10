/**
 * On-demand analysis states for a company we don't hold yet.
 *
 * `AnalyzePrompt` — nothing scraped: explain and offer the Analyze button.
 * `AnalyzingState` — a scrape was dispatched: a calm progress panel; the hook
 *  is polling and will swap this for the real dashboard when the data lands.
 */

import type { CSSProperties } from 'react'
import { T } from '../ui/tokens'

const panel: CSSProperties = {
  minHeight: 260,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 14,
  padding: 24,
  textAlign: 'center',
}

export function AnalyzePrompt({
  ticker,
  onAnalyze,
}: {
  ticker: string
  onAnalyze: () => void
}) {
  return (
    <div style={panel}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: T.primaryLight,
          color: T.primary,
          fontSize: 24,
        }}
        aria-hidden
      >
        ⟳
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>
        {ticker} isn’t analyzed yet
      </div>
      <div style={{ fontSize: 13, color: T.inkMuted, maxWidth: 380, lineHeight: 1.5 }}>
        Pull {ticker}’s last five quarters and five years — P&amp;L, balance sheet, cash flow and
        KPIs — straight from Screener. This takes about three minutes; the dashboard fills in
        automatically when it’s done.
      </div>
      <button
        type="button"
        onClick={onAnalyze}
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#fff',
          background: T.primary,
          border: 'none',
          borderRadius: 10,
          padding: '10px 22px',
          cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(79,70,229,0.25)',
        }}
      >
        Analyze {ticker}
      </button>
    </div>
  )
}

export function AnalyzingState({ ticker }: { ticker: string }) {
  return (
    <div style={panel}>
      <div className="dash-spinner" aria-hidden />
      <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>Analyzing {ticker}…</div>
      <div style={{ fontSize: 13, color: T.inkMuted, maxWidth: 380, lineHeight: 1.5 }}>
        Fetching {ticker}’s statements from Screener — usually about three minutes. You can leave
        this open; it refreshes on its own and the dashboard appears the moment the data is in.
      </div>
      <div
        role="status"
        aria-live="polite"
        style={{ fontSize: 12, color: T.inkHint, fontWeight: 600, letterSpacing: '0.03em' }}
      >
        Scraping · checking every 15s
      </div>
    </div>
  )
}
