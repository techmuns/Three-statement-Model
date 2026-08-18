/**
 * Point 2 of the Dhamma scope: the key KPIs, and how they compare to the
 * company's own history ("own comparables") and to peers.
 *
 * KPI cards carry the trailing series and the change vs the prior period — the
 * self-comparison, on the selected cadence. The Peer Comparison sets the
 * company's latest-year KPIs beside its comparables, each peer's KPIs derived
 * from that peer's own scraped statements. Peers that aren't analyzed yet can be
 * filled in right here — "Run all peers" scrapes them all in one run, and each
 * row turns from "—" into real KPIs the moment its data lands.
 */

import type { CSSProperties } from 'react'
import type { PeriodViewId } from '@/config/navigation'
import type { CompanyFinancials } from '@/types/financials'
import { statementSetFor } from '@/lib/statements'
import { deriveKpis } from '../data/metrics'
import { usePeerComparison } from '../data/peerKpis'
import { WidgetCard } from '../ui/WidgetCard'
import { LoadingState, UnavailableState } from '../ui/states'
import { KpiCard } from '../components/KpiCard'
import { PeerTable } from '../components/PeerTable'
import { T } from '../ui/tokens'

const runAllBtn: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#fff',
  background: T.primary,
  border: 'none',
  borderRadius: 8,
  padding: '5px 13px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  boxShadow: '0 4px 10px rgba(79,70,229,0.22)',
}

function pill(bg: string, color: string): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    color,
    background: bg,
    borderRadius: 999,
    padding: '4px 10px',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
  }
}

export function KpisTab({
  financials,
  companyName,
  period,
}: {
  financials: CompanyFinancials
  companyName: string
  period: PeriodViewId
}) {
  const set = statementSetFor(financials, period)
  const kpis = deriveKpis(set)
  const { rows, loading, analyzing, runnable, message, canAnalyze, runAll, runPeer } =
    usePeerComparison(financials, companyName)
  const periodLabel = period === 'quarters' ? 'last 5 quarters' : 'last 5 financial years'

  const peerCount = rows.length - 1
  const hasPeers = peerCount > 0
  const derivedCount = rows.filter((r) => !r.isSubject && r.origin === 'derived').length
  const analyzingCount = analyzing.size
  const runnableCount = runnable.length

  const peerAction =
    !canAnalyze || !hasPeers ? undefined : analyzingCount > 0 ? (
      <span style={pill('#fffbeb', '#d97706')}>
        <span className="dash-spin" style={{ display: 'inline-block' }}>
          ⟳
        </span>
        Analyzing {analyzingCount}…
      </span>
    ) : runnableCount > 0 ? (
      <button type="button" onClick={runAll} style={runAllBtn}>
        Run all peers ({runnableCount})
      </button>
    ) : (
      <span style={pill('#f0fdf4', '#16a34a')}>All peers analyzed ✓</span>
    )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <WidgetCard title="Key KPIs" subtitle={`Latest value, trend and change vs prior period · ${periodLabel}`} padded>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {kpis.map((kpi) => (
            <KpiCard key={kpi.id} kpi={kpi} />
          ))}
        </div>
      </WidgetCard>

      <WidgetCard
        title="Peer Comparison"
        subtitle={
          hasPeers
            ? `${companyName} vs ${peerCount} peer${peerCount === 1 ? '' : 's'} · ${derivedCount} analyzed · latest FY, derived like-for-like`
            : 'Sector comparables'
        }
        right={peerAction}
      >
        {loading ? (
          <LoadingState rows={6} />
        ) : hasPeers ? (
          <>
            {message && (
              <div
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  color: '#b45309',
                  background: '#fffbeb',
                  borderBottom: `1px solid ${T.borderDefault}`,
                }}
              >
                {message}
              </div>
            )}
            <PeerTable rows={rows} analyzing={analyzing} canAnalyze={canAnalyze} onAnalyze={runPeer} />
          </>
        ) : (
          <UnavailableState
            note="No peers mapped for this company yet."
            hint="Peers come from Screener's peer table, captured when the company is analyzed."
          />
        )}
      </WidgetCard>
    </div>
  )
}
