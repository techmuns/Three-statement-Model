/**
 * Revenue mix by segment from the earnings call (Concall Deep Dive).
 *
 * Management states a segment split as percentages on the call; that app extracts
 * and fact-checks it against the transcript. We render just those shares (a
 * stacked bar + legend) and label the source honestly — no ₹cr figure is shown,
 * because the call gives a percentage, not an audited segment revenue.
 */

import { formatPercent } from '@/lib/format'
import { SEGMENT_PALETTE as PALETTE, T } from '../ui/tokens'

export function ConcallSegmentMix({
  segments,
  quarter,
}: {
  segments: readonly { readonly name: string; readonly pct: number }[]
  quarter: string | null
}) {
  const slices = segments
    .filter((s) => s.pct > 0)
    .map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }))
    .sort((a, b) => b.pct - a.pct)

  if (slices.length === 0) {
    return (
      <div style={{ padding: 16, fontSize: 13, color: T.inkHint }}>No segment split reported on the call.</div>
    )
  }

  const label = `Revenue mix by segment: ${slices.map((s) => `${s.name} ${s.pct.toFixed(0)}%`).join(', ')}`

  return (
    <div style={{ padding: 16 }} role="img" aria-label={label}>
      <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 14 }}>
        {slices.map((s) => (
          <div key={s.name} style={{ width: `${s.pct}%`, background: s.color }} title={`${s.name} ${s.pct}%`} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {slices.map((s) => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span
              style={{
                color: T.inkSecondary,
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {s.name}
            </span>
            <span
              style={{
                color: T.ink,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                width: 52,
                textAlign: 'right',
              }}
            >
              {formatPercent(s.pct)}
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: T.inkHint, lineHeight: 1.4 }}>
        Segment split from the {quarter ? `${quarter} ` : ''}earnings call (management-stated), fact-checked against
        the transcript. Not an audited segment filing.
      </div>
    </div>
  )
}
