/**
 * One KPI: its latest value, the change against the prior period (the company's
 * own comparable), and a sparkline of the trailing series — the "own
 * comparables" half of the scope. All computed from the statements, so it can
 * never disagree with the P&L it came from.
 */

import { formatPercent, formatRatio } from '@/lib/format'
import type { KpiDefinition } from '@/types/kpi'
import type { Reported } from '@/types/common'
import type { DerivedKpi } from '../data/metrics'
import { T } from '../ui/tokens'

function formatValue(value: Reported<number>, def: KpiDefinition): string {
  if (value === null) return '—'
  return def.unit === 'percent' ? formatPercent(value, def.precision) : formatRatio(value, def.precision)
}

function formatDelta(delta: Reported<number>, def: KpiDefinition): string | null {
  if (delta === null) return null
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : ''
  const abs = Math.abs(delta)
  return def.unit === 'percent' ? `${sign}${abs.toFixed(def.precision)} pp` : `${sign}${abs.toFixed(def.precision)}`
}

function deltaIsGood(delta: Reported<number>, direction: KpiDefinition['direction']): boolean | null {
  if (delta === null || delta === 0) return null
  return direction === 'higher-is-better' ? delta > 0 : delta < 0
}

function Sparkline({ values }: { values: readonly Reported<number>[] }) {
  const points = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null)
  if (points.length < 2) return null
  const w = 120
  const h = 28
  const xs = values.length - 1 || 1
  const nums = points.map((p) => p.v)
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1
  const coords = points.map((p) => {
    const x = (p.i / xs) * (w - 2) + 1
    const y = h - 1 - ((p.v - min) / span) * (h - 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const last = coords[coords.length - 1].split(',')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ display: 'block' }}>
      <polyline points={coords.join(' ')} fill="none" stroke={T.primary} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill={T.primary} />
    </svg>
  )
}

export function KpiCard({ kpi }: { kpi: DerivedKpi }) {
  const { definition, latest, delta, series } = kpi
  const good = deltaIsGood(delta, definition.direction)
  const deltaText = formatDelta(delta, definition)
  const deltaColor = good === null ? T.inkMuted : good ? T.good : T.bad
  const scope = series.length ? `${series[0].label}–${series[series.length - 1].label}` : ''

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${T.borderDefault}`,
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
      title={definition.formula}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.inkMuted }}>{definition.shortLabel}</span>
        <span style={{ fontSize: 10, color: T.inkHint, whiteSpace: 'nowrap' }}>{scope}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
          {formatValue(latest, definition)}
        </span>
        <Sparkline values={series.map((p) => p.value)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, color: T.inkHint }}>{definition.label}</span>
        {deltaText && (
          <span style={{ fontSize: 12, fontWeight: 600, color: deltaColor, whiteSpace: 'nowrap' }}>
            {deltaText} vs prev
          </span>
        )}
      </div>
    </div>
  )
}
