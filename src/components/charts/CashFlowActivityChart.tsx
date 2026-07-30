import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CashFlowPeriod } from '@/types/financials'
import { seriesColor } from '@/theme/tokens'
import { croreAxisFormatter, formatCrore } from '@/lib/format'
import { ChartTooltipCard, type ChartTooltipProps } from './ChartTooltip'

type CashKey = 'cashFromOperating' | 'cashFromInvesting' | 'cashFromFinancing'

const ACTIVITY_SERIES: readonly { key: CashKey; name: string }[] = [
  { key: 'cashFromOperating', name: 'Operating (CFO)' },
  { key: 'cashFromInvesting', name: 'Investing (CFI)' },
  { key: 'cashFromFinancing', name: 'Financing (CFF)' },
]

/** Net cash flow takes the slot after the three activities. */
const NET_COLOR = seriesColor(3)

type CashRow = { label: string; net: number } & Record<CashKey, number>

/**
 * Cash generated and used across the selected years.
 *
 * CFO, CFI and CFF are **grouped** bars, not stacked: two of the three are
 * routinely negative, and stacking signed values puts segments on both sides of
 * zero where their lengths stop reading as parts of a whole. Grouped bars off a
 * shared zero baseline let each activity's sign and size be read directly.
 *
 * Net cash flow is the sum of the three, so it is a line over the same bars
 * rather than a fourth bar — same unit, same ₹ crore scale, so this is one
 * honest axis, not a dual-axis overlay that would invent a correlation. Every
 * plotted number also appears in the statement table on this tab.
 */
export function CashFlowActivityChart({ periods }: { periods: readonly CashFlowPeriod[] }) {
  if (periods.length === 0) return null

  const latest = periods[periods.length - 1]
  const series = ACTIVITY_SERIES.map((item, index) => ({
    ...item,
    color: seriesColor(index),
    latest: latest[item.key],
  }))

  const rows: CashRow[] = periods.map((period) => ({
    label: period.period.label,
    cashFromOperating: period.cashFromOperating,
    cashFromInvesting: period.cashFromInvesting,
    cashFromFinancing: period.cashFromFinancing,
    net: period.netCashFlow,
  }))

  // One axis spans every bar and the net line so the zero baseline is shared.
  const axisTick = croreAxisFormatter(
    periods.flatMap((p) => [
      p.cashFromOperating,
      p.cashFromInvesting,
      p.cashFromFinancing,
      p.netCashFlow,
    ]),
  )

  const renderTooltip = (props: ChartTooltipProps) => {
    if (!props.active || !props.payload) return null
    return (
      <ChartTooltipCard
        title={String(props.label)}
        rows={props.payload.map((entry) => {
          const isNet = entry.dataKey === 'net'
          const match = series.find((item) => item.key === entry.dataKey)
          return {
            key: String(entry.dataKey),
            label: isNet ? 'Net cash flow' : (match?.name ?? String(entry.dataKey)),
            color: isNet ? NET_COLOR : (match?.color ?? seriesColor(0)),
            value: `₹${formatCrore(typeof entry.value === 'number' ? entry.value : null)} cr`,
          }
        })}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            style={{ backgroundColor: NET_COLOR }}
            className="size-2 rounded-[2px] ring-1 ring-inset ring-black/10"
          />
          <span className="text-caption font-semibold text-ink-secondary">
            Net cash flow · ₹ crore
          </span>
        </span>
        <span className="text-caption text-ink-subtle">
          {latest.period.label}{' '}
          <span className="tabular font-semibold text-ink-primary">
            ₹{formatCrore(latest.netCashFlow)} cr
          </span>
        </span>
      </div>

      <div
        role="img"
        aria-label={`Cash flow by activity, by year. Latest year ${latest.period.label}: ${series
          .map((item) => `${item.name} ₹${formatCrore(item.latest)} crore`)
          .join('; ')}; Net cash flow ₹${formatCrore(latest.netCashFlow)} crore.`}
      >
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart
            data={rows}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            barCategoryGap="24%"
          >
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
            {/* The baseline every bar and the net line are read against. */}
            <ReferenceLine y={0} stroke="var(--color-chart-axis)" strokeWidth={1} />
            <Tooltip
              cursor={{ fill: 'var(--color-chart-grid)', fillOpacity: 0.6 }}
              content={renderTooltip}
            />
            {series.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                fill={item.color}
                maxBarSize={22}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            ))}
            <Line
              type="linear"
              dataKey="net"
              stroke={NET_COLOR}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              isAnimationActive={false}
              dot={{ r: 4, fill: NET_COLOR, stroke: 'var(--color-surface-card)', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: NET_COLOR, stroke: 'var(--color-surface-card)', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend is the direct-label channel for the latest year. */}
      <ul className="flex flex-col gap-1.5">
        {series.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-caption">
            <span
              aria-hidden="true"
              style={{ backgroundColor: item.color }}
              className="size-2.5 shrink-0 rounded-[2px] ring-1 ring-inset ring-black/10"
            />
            <span className="min-w-0 truncate text-ink-secondary">{item.name}</span>
            <span className="tabular ml-auto shrink-0 text-right font-semibold text-ink-primary">
              ₹{formatCrore(item.latest)} cr
            </span>
          </li>
        ))}
        {/* Net cash flow is a line, so it carries a line swatch, not a square. */}
        <li className="flex items-center gap-2 text-caption">
          <span aria-hidden="true" className="flex size-2.5 shrink-0 items-center justify-center">
            <span style={{ backgroundColor: NET_COLOR }} className="h-0.5 w-2.5 rounded-full" />
          </span>
          <span className="min-w-0 truncate text-ink-secondary">Net cash flow</span>
          <span className="tabular ml-auto shrink-0 text-right font-semibold text-ink-primary">
            ₹{formatCrore(latest.netCashFlow)} cr
          </span>
        </li>
      </ul>
    </div>
  )
}
