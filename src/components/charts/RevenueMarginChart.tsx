import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ProfitLossPeriod } from '@/types/financials'
import { seriesColor } from '@/theme/tokens'
import { croreAxisFormatter, formatCrore, formatPercent } from '@/lib/format'
import type { ProfitLossLabels } from '@/lib/statementLabels'
import { ChartTooltipCard, payloadValue, type ChartTooltipProps } from './ChartTooltip'

const REVENUE_COLOR = seriesColor(0)
const MARGIN_COLOR = seriesColor(1)

/** Identical on both panels so the two x-axes line up under each other. */
const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const
const Y_AXIS_WIDTH = 62

interface ChartDatum {
  periodId: string
  label: string
  longLabel: string
  sales: number
  opm: number
}

function toChartData(periods: readonly ProfitLossPeriod[]): ChartDatum[] {
  return periods.map((entry) => ({
    periodId: entry.period.id,
    label: entry.period.label,
    longLabel: entry.period.longLabel,
    sales: entry.sales,
    opm: entry.opmPercent,
  }))
}

const axisTickStyle = {
  fill: 'var(--color-ink-subtle)',
  fontSize: 11,
} as const

/**
 * Evenly spaced whole-percent ticks spanning the data.
 *
 * Computed rather than left to Recharts: given a domain it cannot divide
 * evenly, Recharts silently drops a tick, producing a scale that reads
 * `30 · 26 · 24 · 22` — uneven steps that misrepresent the spacing between
 * gridlines.
 */
function percentAxis(values: readonly number[]): { domain: [number, number]; ticks: number[] } {
  const low = Math.floor(Math.min(...values) - 0.5)
  const high = Math.ceil(Math.max(...values) + 0.5)
  const step = Math.max(1, Math.ceil((high - low) / 4))

  const ticks: number[] = []
  for (let tick = low; tick < high + step; tick += step) ticks.push(tick)

  return { domain: [low, ticks[ticks.length - 1]], ticks }
}

/**
 * Small header above each panel: what is plotted, and its latest value.
 *
 * This is the endpoint direct-label. Putting it in the panel chrome rather than
 * on the mark keeps a value readable without hovering, without printing a
 * number on every column.
 */
function PanelHeader({
  title,
  color,
  latestLabel,
  latestValue,
}: {
  title: string
  color: string
  latestLabel: string
  latestValue: string
}) {
  return (
    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          style={{ backgroundColor: color }}
          className="size-2 rounded-[2px] ring-1 ring-inset ring-black/10"
        />
        <span className="text-caption font-semibold text-ink-secondary">{title}</span>
      </span>
      <span className="text-caption text-ink-subtle">
        {latestLabel}{' '}
        <span className="tabular font-semibold text-ink-primary">{latestValue}</span>
      </span>
    </div>
  )
}

function RevenueTooltip(props: ChartTooltipProps, labels: ProfitLossLabels) {
  if (!props.active) return null
  const value = payloadValue(props, 'sales')
  if (value === null) return null

  return (
    <ChartTooltipCard
      title={String(props.label)}
      rows={[
        {
          key: 'sales',
          label: labels.salesShort,
          color: REVENUE_COLOR,
          value: `₹${formatCrore(value)} cr`,
        },
      ]}
    />
  )
}

function MarginTooltip(props: ChartTooltipProps, labels: ProfitLossLabels) {
  if (!props.active) return null
  const value = payloadValue(props, 'opm')
  if (value === null) return null

  return (
    <ChartTooltipCard
      title={String(props.label)}
      rows={[
        { key: 'opm', label: labels.opmShort, color: MARGIN_COLOR, value: formatPercent(value) },
      ]}
    />
  )
}

/**
 * Revenue and operating margin across the selected periods.
 *
 * Deliberately **two stacked panels rather than one dual-axis plot**. Revenue is
 * in ₹ crore and margin in percent; overlaying them on two y-scales would make
 * the alignment of the two scales — and so any apparent correlation — an
 * artefact of where the axes were pinned. The panels share one set of period
 * categories and identical margins, so they read as a single figure while each
 * series keeps its own honest scale.
 *
 * Every value plotted here also appears in the P&L table on this tab, which is
 * the chart's table-view twin.
 */
export function RevenueMarginChart({
  periods,
  labels,
}: {
  periods: readonly ProfitLossPeriod[]
  labels: ProfitLossLabels
}) {
  const data = toChartData(periods)
  if (data.length === 0) return null

  const latest = data[data.length - 1]
  const revenueTick = croreAxisFormatter(data.map((entry) => entry.sales))
  const marginAxis = percentAxis(data.map((entry) => entry.opm))

  return (
    <div className="flex flex-col gap-4">
      <div
        role="img"
        aria-label={`${labels.salesShort} by period, ${data
          .map((entry) => `${entry.label} ₹${formatCrore(entry.sales)} crore`)
          .join('; ')}.`}
      >
        <PanelHeader
          title={`${labels.salesShort} · ₹ crore`}
          color={REVENUE_COLOR}
          latestLabel={latest.label}
          latestValue={formatCrore(latest.sales)}
        />
        <ResponsiveContainer width="100%" height={148}>
          <BarChart data={data} margin={CHART_MARGIN} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" strokeWidth={1} />
            <XAxis dataKey="label" hide />
            <YAxis
              width={Y_AXIS_WIDTH}
              tickFormatter={revenueTick}
              tick={axisTickStyle}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-chart-grid)', fillOpacity: 0.6 }}
              content={(props) => RevenueTooltip(props, labels)}
            />
            <Bar
              dataKey="sales"
              fill={REVENUE_COLOR}
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        role="img"
        aria-label={`${labels.opmShort} by period, ${data
          .map((entry) => `${entry.label} ${formatPercent(entry.opm)}`)
          .join('; ')}.`}
      >
        <PanelHeader
          title={`${labels.opmShort} · %`}
          color={MARGIN_COLOR}
          latestLabel={latest.label}
          latestValue={formatPercent(latest.opm)}
        />
        {/* Height includes the x-axis band, so the card never grows a nested scrollbar. */}
        <ResponsiveContainer width="100%" height={132}>
          <LineChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" strokeWidth={1} />
            <XAxis
              dataKey="label"
              tick={axisTickStyle}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-chart-axis)' }}
              tickMargin={8}
            />
            <YAxis
              width={Y_AXIS_WIDTH}
              domain={marginAxis.domain}
              ticks={marginAxis.ticks}
              // Render every tick we computed. Recharts' default elides
              // labels it thinks might collide, which reintroduces the
              // uneven-looking scale the explicit ticks exist to prevent.
              interval={0}
              tickFormatter={(value: number) => `${value}%`}
              tick={axisTickStyle}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ stroke: 'var(--color-chart-axis)', strokeWidth: 1 }}
              content={(props) => MarginTooltip(props, labels)}
            />
            <Line
              type="linear"
              dataKey="opm"
              stroke={MARGIN_COLOR}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              isAnimationActive={false}
              // 8px marker with a 2px surface ring, so points stay legible
              // where they sit on the line or near a gridline.
              dot={{
                r: 4,
                fill: MARGIN_COLOR,
                stroke: 'var(--color-surface-card)',
                strokeWidth: 2,
              }}
              activeDot={{
                r: 5,
                fill: MARGIN_COLOR,
                stroke: 'var(--color-surface-card)',
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
