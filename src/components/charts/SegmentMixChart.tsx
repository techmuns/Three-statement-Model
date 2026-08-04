import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { RevenueSegment } from '@/types/financials'
import type { PeriodRef } from '@/types/period'
import { seriesColor } from '@/theme/tokens'
import { formatCrore, formatPercent } from '@/lib/format'
import { ChartTooltipCard, type ChartTooltipProps } from './ChartTooltip'

interface SegmentSeries {
  id: string
  name: string
  color: string
  latestShare: number | null
  latestRevenue: number | null
}

type MixRow = { label: string } & Record<string, number | string>

/**
 * Business-segment revenue mix as a share of sales, per period.
 *
 * Shares rather than absolute revenue, so the mix is comparable across periods
 * of different size — the question this widget answers is "what is the shape of
 * the business", not "how big is it" (the trend chart above answers that).
 *
 * Segments take categorical slots in the order the data lists them, so a
 * segment keeps its colour as periods change. Slots 3-5 sit below 3:1 against
 * the surface, so every segment also carries a named legend entry with its
 * latest value — identity and value are both reachable without relying on hue.
 */
export function SegmentMixChart({
  segments,
  periods,
}: {
  segments: readonly RevenueSegment[]
  periods: readonly PeriodRef[]
}) {
  if (segments.length === 0 || periods.length === 0) return null

  const latestPeriodId = periods[periods.length - 1].id

  const series: SegmentSeries[] = segments.map((segment, index) => {
    const latest = segment.values.find((value) => value.periodId === latestPeriodId) ?? null
    return {
      id: segment.id,
      name: segment.name,
      color: seriesColor(index),
      latestShare: latest?.sharePercent ?? null,
      latestRevenue: latest?.revenue ?? null,
    }
  })

  const rows: MixRow[] = periods.map((period) => {
    const row: MixRow = { label: period.label }
    for (const segment of segments) {
      const value = segment.values.find((entry) => entry.periodId === period.id)
      row[segment.id] = value?.sharePercent ?? 0
    }
    return row
  })

  // The full text equivalent of the chart. Unlike the statement tabs, segment
  // mix has no table twin, so per-period shares would otherwise be reachable
  // only by hovering — the aria-label therefore enumerates every period, not
  // just the latest.
  const chartDescription = `Revenue mix by segment, share of sales across ${periods.length} periods. ${periods
    .map(
      (period) =>
        `${period.label}: ${segments
          .map((segment) => {
            const value = segment.values.find((entry) => entry.periodId === period.id)
            return `${segment.name} ${formatPercent(value?.sharePercent ?? null)}`
          })
          .join(', ')}`,
    )
    .join('. ')}.`

  const renderTooltip = (props: ChartTooltipProps) => {
    if (!props.active || !props.payload) return null

    return (
      <ChartTooltipCard
        title={String(props.label)}
        // Newest segment on top of the stack reads first in the tooltip.
        rows={[...props.payload].reverse().map((entry) => {
          const match = series.find((item) => item.id === entry.dataKey)
          return {
            key: String(entry.dataKey),
            label: match?.name ?? String(entry.dataKey),
            color: match?.color ?? seriesColor(0),
            value: formatPercent(typeof entry.value === 'number' ? entry.value : null),
          }
        })}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="img" aria-label={chartDescription}>
        <ResponsiveContainer width="100%" height={176}>
          <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" strokeWidth={1} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--color-ink-subtle)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-chart-axis)' }}
              tickMargin={8}
            />
            <YAxis
              width={40}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(value: number) => `${value}%`}
              tick={{ fill: 'var(--color-ink-subtle)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-chart-grid)', fillOpacity: 0.6 }}
              content={renderTooltip}
            />
            {series.map((segment) => (
              <Bar
                key={segment.id}
                dataKey={segment.id}
                stackId="mix"
                fill={segment.color}
                maxBarSize={40}
                isAnimationActive={false}
                // A 2px stroke in the surface colour is how SVG stacking gets
                // the 2px surface gap between touching segments — it separates
                // with space, not with a contrasting border.
                stroke="var(--color-surface-card)"
                strokeWidth={2}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend doubles as the direct-label channel for the latest period. */}
      <ul className="flex flex-col gap-1.5">
        {series.map((segment) => (
          <li key={segment.id} className="flex items-center gap-2 text-caption">
            <span
              aria-hidden="true"
              style={{ backgroundColor: segment.color }}
              className="size-2.5 shrink-0 rounded-[2px] ring-1 ring-inset ring-black/10"
            />
            <span title={segment.name} className="min-w-0 truncate text-ink-secondary">
              {segment.name}
            </span>
            <span className="tabular ml-auto shrink-0 font-semibold text-ink-primary">
              {formatPercent(segment.latestShare)}
            </span>
            <span className="tabular w-24 shrink-0 text-right text-ink-subtle">
              ₹{formatCrore(segment.latestRevenue)} cr
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
