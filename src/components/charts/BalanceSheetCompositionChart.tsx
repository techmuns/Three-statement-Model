import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BalanceSheetPeriod } from '@/types/financials'
import { seriesColor } from '@/theme/tokens'
import { croreAxisFormatter, formatCrore } from '@/lib/format'
import { ChartTooltipCard, type ChartTooltipProps } from './ChartTooltip'

type FundingKey = 'equityCapital' | 'reserves' | 'borrowings' | 'otherLiabilities'

/**
 * Funding lines in stack order, equity at the base. The order fixes the
 * categorical colour slots, so a line keeps its colour year on year.
 */
const FUNDING_SERIES: readonly { key: FundingKey; name: string }[] = [
  { key: 'equityCapital', name: 'Equity Capital' },
  { key: 'reserves', name: 'Reserves' },
  { key: 'borrowings', name: 'Borrowings' },
  { key: 'otherLiabilities', name: 'Other Liabilities' },
]

type BuildRow = { label: string } & Record<FundingKey, number>

/**
 * How a company funds its balance sheet, across the selected years.
 *
 * An **absolute** stacked bar, not a 100% stack: the stack total is total
 * liabilities (= total assets), so the bar's height carries balance-sheet
 * growth while the segments carry composition. A 100% stack would normalise the
 * height away and hide the growth, which is half of what a balance sheet says.
 *
 * The four funding lines take categorical slots 0–3. Slots 3–5 sit below 3:1 on
 * the surface, so the legend carries each line's name and latest value —
 * identity and value are reachable without relying on hue. Every plotted number
 * also appears in the statement table on this tab, the chart's table-view twin.
 */
export function BalanceSheetCompositionChart({
  periods,
}: {
  periods: readonly BalanceSheetPeriod[]
}) {
  if (periods.length === 0) return null

  const latest = periods[periods.length - 1]
  const series = FUNDING_SERIES.map((item, index) => ({
    ...item,
    color: seriesColor(index),
    latest: latest[item.key],
  }))

  const rows: BuildRow[] = periods.map((period) => {
    const row = { label: period.period.label } as BuildRow
    for (const item of FUNDING_SERIES) row[item.key] = period[item.key]
    return row
  })

  const axisTick = croreAxisFormatter(periods.map((p) => p.totalLiabilities))

  const renderTooltip = (props: ChartTooltipProps) => {
    if (!props.active || !props.payload) return null
    return (
      <ChartTooltipCard
        title={String(props.label)}
        // Top of the stack reads first in the tooltip.
        rows={[...props.payload].reverse().map((entry) => {
          const match = series.find((item) => item.key === entry.dataKey)
          return {
            key: String(entry.dataKey),
            label: match?.name ?? String(entry.dataKey),
            color: match?.color ?? seriesColor(0),
            value: `₹${formatCrore(typeof entry.value === 'number' ? entry.value : null)} cr`,
          }
        })}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-caption font-semibold text-ink-secondary">Funding mix · ₹ crore</span>
        <span className="text-caption text-ink-subtle">
          {latest.period.label}{' '}
          <span className="tabular font-semibold text-ink-primary">
            ₹{formatCrore(latest.totalLiabilities)} cr
          </span>
        </span>
      </div>

      <div
        role="img"
        aria-label={`Balance sheet funding mix by year. Latest year ${latest.period.label}: ${series
          .map((item) => `${item.name} ₹${formatCrore(item.latest)} crore`)
          .join('; ')}. Total ₹${formatCrore(latest.totalLiabilities)} crore.`}
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" strokeWidth={1} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--color-ink-subtle)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-chart-axis)' }}
              tickMargin={8}
            />
            <YAxis
              width={62}
              tickFormatter={axisTick}
              tick={{ fill: 'var(--color-ink-subtle)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-chart-grid)', fillOpacity: 0.6 }}
              content={renderTooltip}
            />
            {series.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                stackId="funding"
                fill={item.color}
                maxBarSize={48}
                isAnimationActive={false}
                // A 2px stroke in the surface colour is how SVG stacking gets the
                // gap between touching segments — space, not a contrasting border.
                stroke="var(--color-surface-card)"
                strokeWidth={2}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend doubles as the direct-label channel for the latest year. */}
      <ul className="flex flex-col gap-1.5">
        {series.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-caption">
            <span
              aria-hidden="true"
              style={{ backgroundColor: item.color }}
              className="size-2.5 shrink-0 rounded-[2px] ring-1 ring-inset ring-black/10"
            />
            <span title={item.name} className="min-w-0 truncate text-ink-secondary">
              {item.name}
            </span>
            <span className="tabular ml-auto shrink-0 text-right font-semibold text-ink-primary">
              ₹{formatCrore(item.latest)} cr
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
