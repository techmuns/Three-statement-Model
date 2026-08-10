/**
 * Point 2 of the Dhamma scope: the key KPIs, and how they compare to the
 * company's own history ("own comparables") and to peers.
 *
 * KPI cards carry the trailing series and the change vs the prior period — the
 * self-comparison, on the selected cadence. The peer table sets the company's
 * latest-year KPIs beside its comparables, each peer's KPIs derived from that
 * peer's own scraped statements (not a single carried column).
 */

import type { PeriodViewId } from '@/config/navigation'
import type { CompanyFinancials } from '@/types/financials'
import { statementSetFor } from '@/lib/statements'
import { deriveKpis } from '../data/metrics'
import { usePeerKpis } from '../data/peerKpis'
import { WidgetCard } from '../ui/WidgetCard'
import { LoadingState, UnavailableState } from '../ui/states'
import { KpiCard } from '../components/KpiCard'
import { PeerTable } from '../components/PeerTable'
import { T } from '../ui/tokens'

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
  const { rows, loading } = usePeerKpis(financials, companyName)
  const periodLabel = period === 'quarters' ? 'last 5 quarters' : 'last 5 financial years'

  const hasPeers = rows.length > 1
  const derivedCount = rows.filter((r) => !r.isSubject && r.origin === 'derived').length

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
            ? `${derivedCount} peer${derivedCount === 1 ? '' : 's'} with full statements · latest FY, derived like-for-like`
            : 'Sector comparables'
        }
      >
        {loading ? (
          <LoadingState rows={6} />
        ) : hasPeers ? (
          <PeerTable rows={rows} />
        ) : (
          <UnavailableState
            note="No peers mapped for this company yet."
            hint="Peers come from Screener's peer table, captured when the company is analyzed."
          />
        )}
      </WidgetCard>

      <div style={{ fontSize: 12, color: T.inkHint }}>
        KPIs are computed from the scraped statements, so they match the P&L and balance sheet exactly.
        Balance-sheet KPIs (ROE, ROCE, D/E) need the annual balance sheet — in the 5-quarter view the cards show “—”.
        In the peer table, a <strong>peer</strong> row is derived from that company’s own statements; a
        <strong> carried</strong> row is Screener’s snapshot; <strong>not analyzed</strong> means we haven’t scraped it yet.
      </div>
    </div>
  )
}
