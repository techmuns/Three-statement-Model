import { KpiSparkline } from '@/components/charts/KpiSparkline'
import { formatKpiGap, formatKpiValue } from '@/lib/kpiFormat'
import { seriesColor, type StatusTone } from '@/theme/tokens'
import type { Reported } from '@/types/common'
import type { KpiDefinition, KpiValue } from '@/types/kpi'
import { DeltaBadge } from './DeltaBadge'

const SPARK_COLOR = seriesColor(0)

function round(value: number, precision: number): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

/**
 * Direction-aware comparison of the company's value to its peer average.
 *
 * Unlike the balance-sheet and cash-flow deltas — deliberately neutral, since a
 * raw stock or flow has no inherent good direction — a KPI has a defined
 * better/worse direction, so the tone is semantic: green when the company is on
 * the favourable side of its peers, red when it is behind. The arrow still
 * comes from the sign of the gap, so a lower-is-better win reads as a green ▼
 * (below peers, and that is the good side), matching the DeltaBadge contract.
 */
function peerDelta(
  value: Reported<number>,
  peerAverage: Reported<number>,
  definition: KpiDefinition,
): { label: string; tone: StatusTone } | null {
  if (value === null || peerAverage === null) return null

  const gap = round(value - peerAverage, definition.precision)
  if (gap === 0) return { label: 'in line with peers', tone: 'neutral' }

  const favorable = definition.direction === 'higher-is-better' ? gap > 0 : gap < 0
  return {
    label: `${formatKpiGap(gap, definition)} vs peers`,
    tone: favorable ? 'good' : 'critical',
  }
}

export interface KpiStatTileProps {
  definition: KpiDefinition
  value: KpiValue
}

/**
 * One KPI: its latest value, how it sits against the peer set, and its trend.
 *
 * Richer than the plain `StatTile` because a KPI is only meaningful in context —
 * the value alone does not say whether it is good. The peer average, median and
 * rank are printed as text (never gated behind the sparkline's hover), and the
 * value-vs-peer badge carries the direction-aware verdict.
 */
export function KpiStatTile({ definition, value }: KpiStatTileProps) {
  const delta = peerDelta(value.value, value.peer.average, definition)
  const hasPeers = value.peer.average !== null

  return (
    <div>
      <p title={definition.description} className="text-caption font-medium text-ink-muted">
        {definition.label}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-stat font-semibold text-ink-primary">
          {formatKpiValue(value.value, definition)}
        </span>
        {delta && <DeltaBadge label={delta.label} tone={delta.tone} />}
      </div>
      <p className="mt-1 text-micro text-ink-subtle">
        {hasPeers ? (
          <>
            Peer avg {formatKpiValue(value.peer.average, definition)} · median{' '}
            {formatKpiValue(value.peer.median, definition)}
            {value.peer.rank !== null && ` · #${value.peer.rank} of ${value.peer.rankedOutOf}`}
          </>
        ) : (
          'No peer cohort'
        )}
      </p>
      <div className="mt-2">
        <KpiSparkline
          points={value.trend.map((point) => ({ label: point.periodId, value: point.value }))}
          color={SPARK_COLOR}
          ariaLabel={`${definition.label} trend: ${value.trend
            .map((point) => `${point.periodId} ${formatKpiValue(point.value, definition)}`)
            .join('; ')}.`}
        />
      </div>
    </div>
  )
}
