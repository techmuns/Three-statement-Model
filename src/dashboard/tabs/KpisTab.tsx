/**
 * Point 2 of the Dhamma scope: the key KPIs, and how they compare to the
 * company's own history ("own comparables") and to peers.
 *
 * KPI cards carry the trailing series and the change vs the prior period — the
 * self-comparison. The peer table sets the latest values beside sector
 * comparables. Every number is derived from the scraped statements; peers are
 * carried from Screener's peer table, which is honest about its thin coverage.
 */

import type { PeriodViewId } from '@/config/navigation'
import type { CompanyFinancials } from '@/types/financials'
import type { KpiId } from '@/types/kpi'
import type { Reported } from '@/types/common'
import { statementSetFor } from '@/lib/statements'
import { deriveKpis } from '../data/metrics'
import { peerGroupFor } from '../data/peers'
import { WidgetCard } from '../ui/WidgetCard'
import { UnavailableState } from '../ui/states'
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
  const group = peerGroupFor(financials.companyId)
  const periodLabel = period === 'quarters' ? 'last 5 quarters' : 'last 5 financial years'

  const subjectKpis = new Map<KpiId, Reported<number>>(kpis.map((k) => [k.id, k.latest]))

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
        subtitle={group ? `${group.label} · subject vs carried peers` : 'Sector comparables'}
      >
        {group ? (
          <PeerTable subjectName={companyName} subjectKpis={subjectKpis} group={group} />
        ) : (
          <UnavailableState
            note="No peer group mapped for this company yet."
            hint="Peer cohorts are assembled per sector from Screener's peer table."
          />
        )}
      </WidgetCard>

      <div style={{ fontSize: 12, color: T.inkHint }}>
        KPIs are computed from the scraped statements, so they match the P&L and balance sheet exactly.
        Balance-sheet KPIs (ROE, ROCE, D/E) need the annual balance sheet — in the 5-quarter view they show “—”.
        Peer values are carried from Screener’s peer table (market cap, ROCE); other peer columns aren’t exposed by that source.
      </div>
    </div>
  )
}
