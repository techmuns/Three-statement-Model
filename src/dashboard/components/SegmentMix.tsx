/**
 * Revenue mix by segment for the latest period — a single stacked bar plus a
 * legend that carries each segment's name, latest revenue and share, so the
 * split is readable without relying on colour alone. Segment disclosure is a
 * separate filing from the summary P&L, so when it has not been scraped the
 * caller shows the honest unavailable state instead of this.
 */

import type { RevenueSegment } from '@/types/financials'
import { formatCrore, formatPercent } from '@/lib/format'
import { SEGMENT_PALETTE as PALETTE, T } from '../ui/tokens'

interface Slice {
  name: string
  revenue: number
  share: number
  color: string
}

export function SegmentMix({ segments, periodId }: { segments: readonly RevenueSegment[]; periodId: string }) {
  const slices: Slice[] = segments
    .map((seg, i) => {
      const point = seg.values.find((v) => v.periodId === periodId)
      return point
        ? { name: seg.name, revenue: point.revenue, share: point.sharePercent, color: PALETTE[i % PALETTE.length] }
        : null
    })
    .filter((s): s is Slice => s !== null && s.share >= 0.05)
    .sort((a, b) => b.share - a.share)

  if (slices.length === 0) {
    return (
      <div style={{ padding: 16, fontSize: 13, color: T.inkHint }}>
        No segment split reported for this period.
      </div>
    )
  }

  const label = `Revenue mix by segment: ${slices.map((s) => `${s.name} ${s.share.toFixed(1)}%`).join(', ')}`

  return (
    <div style={{ padding: 16 }} role="img" aria-label={label}>
      <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 14 }}>
        {slices.map((s) => (
          <div key={s.name} style={{ width: `${s.share}%`, background: s.color }} title={`${s.name} ${s.share.toFixed(1)}%`} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {slices.map((s) => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: T.inkSecondary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.name}
            </span>
            <span style={{ color: T.inkMuted, fontVariantNumeric: 'tabular-nums' }}>₹{formatCrore(s.revenue)} cr</span>
            <span style={{ color: T.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums', width: 52, textAlign: 'right' }}>
              {formatPercent(s.share)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
