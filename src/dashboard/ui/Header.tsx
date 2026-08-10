/**
 * Zone 1: the sticky 48px header — wordmark, live ticker pill, the tab switch,
 * the 5Q/5Y period toggle, and Export. No charts or tables ever live here.
 */

import { useState } from 'react'
import { PERIOD_VIEWS, type PeriodViewId } from '@/config/navigation'
import { Segmented, type SegmentedOption } from './Segmented'
import { T } from './tokens'

export type DashboardTabId = 'financials' | 'kpis'

const TAB_OPTIONS: readonly SegmentedOption<DashboardTabId>[] = [
  { id: 'financials', label: 'Financials' },
  { id: 'kpis', label: 'KPIs' },
]

const PERIOD_OPTIONS: readonly SegmentedOption<PeriodViewId>[] = PERIOD_VIEWS.map((v) => ({
  id: v.id,
  label: v.id === 'quarters' ? '5 Quarters' : '5 Years',
}))

function TickerPill({ ticker, company }: { ticker: string; company: string | null }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        background: T.primaryLight,
        color: T.primaryText,
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 600,
        border: `1px solid ${T.primaryBorder}`,
      }}
    >
      <span style={{ width: 6, height: 6, background: T.primaryDot, borderRadius: '50%' }} />
      {ticker}
      {company && <span style={{ color: '#818cf8', fontWeight: 400 }}>· {company}</span>}
    </span>
  )
}

export function Header({
  ticker,
  company,
  tab,
  onTabChange,
  period,
  onPeriodChange,
  onExport,
}: {
  ticker: string | null
  company: string | null
  tab: DashboardTabId
  onTabChange: (id: DashboardTabId) => void
  period: PeriodViewId
  onPeriodChange: (id: PeriodViewId) => void
  onExport: () => void | Promise<void>
}) {
  const [exporting, setExporting] = useState(false)

  const runExport = async () => {
    setExporting(true)
    try {
      await onExport()
    } finally {
      setExporting(false)
    }
  }

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '0 24px',
        height: 48,
        background: T.headerBar,
        backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${T.hairline}`,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, color: T.ink, margin: 0, whiteSpace: 'nowrap' }}>
          Dhamma Capital · Earnings
        </h1>
        {ticker && <TickerPill ticker={ticker} company={company} />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Segmented
          name="dashboard-tab"
          ariaLabel="Dashboard section"
          options={TAB_OPTIONS}
          value={tab}
          onChange={onTabChange}
        />
        <Segmented
          name="period-view"
          ariaLabel="Reporting period"
          options={PERIOD_OPTIONS}
          value={period}
          onChange={onPeriodChange}
        />
        <button
          type="button"
          onClick={runExport}
          disabled={exporting}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: T.primaryText,
            background: T.primaryLight,
            border: `1px solid ${T.primaryBorder}`,
            borderRadius: 8,
            padding: '5px 12px',
            cursor: exporting ? 'progress' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {exporting ? 'Exporting…' : 'Export PNG'}
        </button>
      </div>
    </header>
  )
}
