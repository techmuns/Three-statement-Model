import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'
import type { Reported } from '@/types/common'

export interface KpiSparklineProps {
  /** Trailing points, oldest → newest. `null` values leave a gap in the line. */
  points: readonly { label: string; value: Reported<number> }[]
  color: string
  /** Full description of the series for assistive tech — the values are never
   * gated behind a hover, so no tooltip; the headline value and this label
   * carry the numbers. */
  ariaLabel: string
}

/**
 * A compact trend line for a KPI stat tile.
 *
 * No axes, grid or tooltip: it is a secondary indicator that shows the shape of
 * the trend, while the tile's headline value and peer line carry the numbers.
 * `null` points (e.g. revenue growth in the oldest year, which has no prior to
 * compare against) leave a gap rather than being drawn as zero.
 */
export function KpiSparkline({ points, color, ariaLabel }: KpiSparklineProps) {
  if (!points.some((point) => point.value !== null)) return null

  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={40}>
        <LineChart data={[...points]} margin={{ top: 4, right: 3, bottom: 2, left: 3 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line
            type="linear"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
