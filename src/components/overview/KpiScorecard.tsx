import { KpiSparkline } from '@/components/charts/KpiSparkline'
import { DeltaBadge } from '@/components/widgets/DeltaBadge'
import { cn } from '@/lib/cn'
import { formatKpiGap, formatKpiValue } from '@/lib/kpiFormat'
import type { SectorPeerStat } from '@/mocks/sectorPeers'
import { type StatusTone } from '@/theme/tokens'
import type { KpiDefinition, KpiHistoryStat, KpiValue } from '@/types/kpi'

const SPARK_COLOR = 'var(--color-brand-400)'

function round(value: number, precision: number): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

/** Change vs the prior period (prior financial year), direction-aware. */
function priorChange(
  value: KpiValue,
  definition: KpiDefinition,
): { label: string; tone: StatusTone } | null {
  if (value.value === null || value.previousValue === null) return null
  const priorId = value.trend.length >= 2 ? value.trend[value.trend.length - 2].periodId : null
  const gap = round(value.value - value.previousValue, definition.precision)
  if (gap === 0) return { label: `unchanged${priorId ? ` vs ${priorId}` : ''}`, tone: 'neutral' }
  const favorable = definition.direction === 'higher-is-better' ? gap > 0 : gap < 0
  return {
    label: `${formatKpiGap(gap, definition)}${priorId ? ` vs ${priorId}` : ''}`,
    tone: favorable ? 'good' : 'critical',
  }
}

/**
 * The card's status: real peer standing where a sector has enough scraped peers,
 * otherwise the honest self-trend standing, otherwise nothing. The label always
 * says which lens it used, so peer- and trend-status are never confused.
 */
function status(
  peerStat: SectorPeerStat | null,
  historyStat: KpiHistoryStat | null,
): { label: string; tone: StatusTone } | null {
  if (peerStat && peerStat.rank !== null) {
    const position = peerStat.rank / peerStat.rankedOutOf
    if (position <= 0.34) return { label: 'Leading sector', tone: 'good' }
    if (position <= 0.67) return { label: 'In line with sector', tone: 'neutral' }
    return { label: 'Lagging sector', tone: 'critical' }
  }
  if (historyStat?.standing === 'better') return { label: 'Above its trend', tone: 'good' }
  if (historyStat?.standing === 'worse') return { label: 'Below its trend', tone: 'critical' }
  if (historyStat?.standing === 'in-line') return { label: 'In line with trend', tone: 'neutral' }
  return null
}

const pillTone: Record<StatusTone, string> = {
  good: 'bg-status-good-soft text-status-good',
  warning: 'bg-status-warning-soft text-status-warning',
  critical: 'bg-status-critical-soft text-status-critical',
  neutral: 'bg-status-neutral-soft text-status-neutral',
}

export interface KpiScorecardProps {
  definition: KpiDefinition
  value: KpiValue
  /** Real sector-peer stat for this KPI, or `null` when the sector lacks enough. */
  peerStat: SectorPeerStat | null
  historyStat: KpiHistoryStat | null
}

/**
 * One KPI scorecard: the value, its change on the prior year, where it sits
 * against real sector peers (or an honest "peer set forming" when too few have
 * been scraped), a status pill, and a sparkline.
 */
export function KpiScorecard({ definition, value, peerStat, historyStat }: KpiScorecardProps) {
  const change = priorChange(value, definition)
  const state = status(peerStat, historyStat)
  const median = peerStat ? formatKpiValue(peerStat.median, definition) : null

  return (
    <section className="flex flex-col overflow-hidden rounded-card border border-line-hairline bg-surface-card shadow-card">
      <span aria-hidden="true" className="h-[3px] bg-gradient-brand" />
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-center gap-1">
          <h3 className="text-caption font-semibold tracking-wide text-ink-muted uppercase">
            {definition.label}
          </h3>
          <span
            title={definition.description}
            aria-label={definition.description}
            className="flex size-3.5 shrink-0 cursor-help items-center justify-center rounded-full text-ink-subtle"
          >
            <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden="true">
              <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 5a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Zm.25 2.25a.5.5 0 0 1 1 0v3.5a.5.5 0 0 1-1 0v-3.5Z" />
            </svg>
          </span>
        </div>

        <div className="flex items-end justify-between gap-2">
          <span className="text-hero leading-none font-semibold text-brand-700">
            {formatKpiValue(value.value, definition)}
          </span>
          <div className="w-16 shrink-0">
            <KpiSparkline
              points={value.trend.map((point) => ({ label: point.periodId, value: point.value }))}
              color={SPARK_COLOR}
              ariaLabel={`${definition.label} trend: ${value.trend
                .map((point) => `${point.periodId} ${formatKpiValue(point.value, definition)}`)
                .join('; ')}.`}
            />
          </div>
        </div>

        {change ? (
          <DeltaBadge label={change.label} tone={change.tone} />
        ) : (
          <span className="text-micro text-ink-subtle">No prior-year comparison</span>
        )}

        <dl className="mt-0.5 flex items-center justify-between gap-2 text-caption">
          <div className="min-w-0">
            <dt className="text-ink-subtle">Peer median</dt>
            <dd className="tabular font-semibold text-ink-secondary">
              {median ?? <span className="font-normal text-ink-subtle">forming</span>}
            </dd>
          </div>
          <div className="min-w-0 text-right">
            <dt className="text-ink-subtle">Rank</dt>
            <dd className="tabular font-semibold text-ink-secondary">
              {peerStat && peerStat.rank !== null ? (
                `#${peerStat.rank} of ${peerStat.rankedOutOf}`
              ) : (
                <span className="font-normal text-ink-subtle">—</span>
              )}
            </dd>
          </div>
        </dl>

        <div
          className={cn(
            'mt-auto rounded-control px-3 py-1.5 text-center text-caption font-semibold',
            state ? pillTone[state.tone] : 'bg-surface-sunken text-ink-subtle',
          )}
        >
          {state?.label ?? 'Peer set forming'}
        </div>
      </div>
    </section>
  )
}
