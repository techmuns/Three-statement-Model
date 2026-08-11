/**
 * Zone 1: the sticky 48px header — wordmark, live ticker pill, the tab switch,
 * the 5Q/5Y period toggle, and an Export menu (Excel / PDF / PNG). No charts or
 * tables ever live here.
 */

import { useEffect, useRef, useState } from 'react'
import { PERIOD_VIEWS, type PeriodViewId } from '@/config/navigation'
import { Segmented, type SegmentedOption } from './Segmented'
import { SearchBox } from './SearchBox'
import { T } from './tokens'

export type DashboardTabId = 'financials' | 'kpis'

type ExportFn = () => void | Promise<void>

const TAB_OPTIONS: readonly SegmentedOption<DashboardTabId>[] = [
  { id: 'financials', label: 'Financials' },
  { id: 'kpis', label: 'KPIs' },
]

const PERIOD_OPTIONS: readonly SegmentedOption<PeriodViewId>[] = PERIOD_VIEWS.map((v) => ({
  id: v.id,
  label: v.id === 'quarters' ? '5 Quarters' : '5 Years',
}))

function ExportMenu({
  onExcel,
  onPdf,
  onPng,
}: {
  onExcel: ExportFn | null
  onPdf: ExportFn
  onPng: ExportFn
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const run = async (label: string, fn: ExportFn) => {
    setOpen(false)
    setBusy(label)
    try {
      await fn()
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setBusy(null)
    }
  }

  const items: { key: string; label: string; fn: ExportFn | null }[] = [
    { key: 'Excel', label: 'Excel (.xlsx)', fn: onExcel },
    { key: 'PDF', label: 'PDF', fn: onPdf },
    { key: 'PNG', label: 'PNG image', fn: onPng },
  ]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy !== null}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: T.primaryText,
          background: T.primaryLight,
          border: `1px solid ${T.primaryBorder}`,
          borderRadius: 8,
          padding: '5px 12px',
          cursor: busy ? 'progress' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {busy ? `${busy}…` : 'Export ▾'}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            minWidth: 160,
            background: '#fff',
            border: `1px solid ${T.hairline}`,
            borderRadius: 10,
            boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
            padding: 4,
            zIndex: 20,
          }}
        >
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              disabled={!it.fn}
              onClick={() => it.fn && run(it.key, it.fn)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                fontSize: 13,
                fontWeight: 500,
                color: it.fn ? T.inkSecondary : T.inkHint,
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                padding: '8px 10px',
                cursor: it.fn ? 'pointer' : 'not-allowed',
              }}
            >
              {it.label}
              {!it.fn && it.key === 'Excel' && (
                <span style={{ color: T.inkHint, fontWeight: 400 }}> · needs data</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Header({
  currentSymbol,
  currentName,
  onSelectCompany,
  tab,
  onTabChange,
  period,
  onPeriodChange,
  onExportExcel,
  onExportPdf,
  onExportPng,
}: {
  currentSymbol: string | null
  currentName: string | null
  onSelectCompany: (symbol: string) => void
  tab: DashboardTabId
  onTabChange: (id: DashboardTabId) => void
  period: PeriodViewId
  onPeriodChange: (id: PeriodViewId) => void
  onExportExcel: ExportFn | null
  onExportPdf: ExportFn
  onExportPng: ExportFn
}) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, color: T.ink, margin: 0, whiteSpace: 'nowrap' }}>
          Dhamma Capital · Earnings
        </h1>
        <SearchBox currentSymbol={currentSymbol} currentName={currentName} onSelect={onSelectCompany} />
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
        <ExportMenu onExcel={onExportExcel} onPdf={onExportPdf} onPng={onExportPng} />
      </div>
    </header>
  )
}
