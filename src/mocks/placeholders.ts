/**
 * Static placeholder content for the shell phase.
 *
 * Every number here is invented. The shape below exists only to feed the card
 * layout — it is intentionally not a financial-statement model. The real
 * schema lands in the data phase and this file is deleted then.
 */

import type { FinancialsTabId, PeriodViewId } from '@/config/navigation'
import type { StatusTone } from '@/theme/tokens'

export interface PlaceholderStat {
  label: string
  value: string
  /** Period-on-period change, already formatted. */
  delta?: { label: string; tone: StatusTone }
}

export interface PlaceholderWidget {
  id: string
  title: string
  subtitle?: string
  badge?: string
  stats: PlaceholderStat[]
  footnote?: string
  /** A wide card spans two columns where the grid has room. */
  wide?: boolean
  /** Renders the empty state instead of the stats — used for panels whose data
   * genuinely does not exist yet. */
  empty?: { message: string; hint: string }
}

const periodLabel: Record<PeriodViewId, string> = {
  quarters: 'Last 5 quarters',
  years: 'Last 5 financial years',
}

const periodUnit: Record<PeriodViewId, string> = {
  quarters: 'Q1 FY26',
  years: 'FY26',
}

/** ₹ crore figures, invented, varied by period so the toggle is visibly live. */
export function financialsWidgets(
  tab: FinancialsTabId,
  period: PeriodViewId,
): PlaceholderWidget[] {
  const quarterly = period === 'quarters'
  const scope = periodLabel[period]
  const unit = periodUnit[period]

  if (tab === 'pl') {
    return [
      {
        id: 'pl-revenue',
        title: 'Revenue',
        subtitle: `${scope} · ₹ crore`,
        badge: 'Sample',
        stats: [
          {
            label: `Revenue — ${unit}`,
            value: quarterly ? '2,48,160' : '9,74,520',
            delta: { label: quarterly ? '+6.2% QoQ' : '+11.4% YoY', tone: 'good' },
          },
          {
            label: 'Other income',
            value: quarterly ? '4,310' : '18,740',
            delta: { label: quarterly ? '−1.8% QoQ' : '+3.1% YoY', tone: quarterly ? 'critical' : 'good' },
          },
        ],
        footnote: 'Placeholder figures — not sourced from any filing.',
      },
      {
        id: 'pl-profitability',
        title: 'Profitability',
        subtitle: `${scope} · margin profile`,
        stats: [
          {
            label: 'Operating margin',
            value: quarterly ? '17.4%' : '16.8%',
            delta: { label: quarterly ? '+40 bps' : '+90 bps', tone: 'good' },
          },
          {
            label: 'Net profit',
            value: quarterly ? '19,320' : '73,640',
            delta: { label: quarterly ? '+4.9% QoQ' : '+8.7% YoY', tone: 'good' },
          },
        ],
      },
      {
        id: 'pl-trend',
        title: 'Revenue & margin trend',
        subtitle: `${scope} · chart lands in the data phase`,
        wide: true,
        stats: [],
        empty: {
          message: 'No chart yet',
          hint: 'This card is reserved for the revenue and margin series once ingest is wired up.',
        },
      },
    ]
  }

  if (tab === 'balance-sheet') {
    return [
      {
        id: 'bs-assets',
        title: 'Assets',
        subtitle: `${scope} · ₹ crore`,
        badge: 'Sample',
        stats: [
          {
            label: 'Total assets',
            value: quarterly ? '18,42,700' : '17,96,400',
            delta: { label: quarterly ? '+2.6% QoQ' : '+9.8% YoY', tone: 'good' },
          },
          { label: 'Cash & equivalents', value: quarterly ? '1,96,410' : '1,74,230' },
        ],
      },
      {
        id: 'bs-liabilities',
        title: 'Liabilities & equity',
        subtitle: `${scope} · ₹ crore`,
        stats: [
          {
            label: 'Total borrowings',
            value: quarterly ? '3,24,880' : '3,41,050',
            delta: { label: quarterly ? '−4.7% QoQ' : '−2.2% YoY', tone: 'good' },
          },
          { label: 'Shareholder equity', value: quarterly ? '8,91,240' : '8,52,600' },
        ],
      },
      {
        id: 'bs-ratios',
        title: 'Leverage',
        subtitle: `${scope} · derived ratios`,
        stats: [
          {
            label: 'Debt to equity',
            value: '0.36',
            delta: { label: quarterly ? '−0.02 QoQ' : '−0.05 YoY', tone: 'good' },
          },
          { label: 'Current ratio', value: quarterly ? '1.18' : '1.24' },
        ],
        footnote: 'Ratios will be computed from the statement data, not stored.',
      },
    ]
  }

  return [
    {
      id: 'cf-operating',
      title: 'Operating cash flow',
      subtitle: `${scope} · ₹ crore`,
      badge: 'Sample',
      stats: [
        {
          label: 'Cash from operations',
          value: quarterly ? '32,470' : '1,28,900',
          delta: { label: quarterly ? '+7.8% QoQ' : '+12.6% YoY', tone: 'good' },
        },
        { label: 'Working capital change', value: quarterly ? '−4,120' : '−16,880' },
      ],
    },
    {
      id: 'cf-investing-financing',
      title: 'Investing & financing',
      subtitle: `${scope} · ₹ crore`,
      stats: [
        {
          label: 'Capital expenditure',
          value: quarterly ? '−21,640' : '−87,300',
          delta: { label: quarterly ? '+11.2% QoQ' : '+5.4% YoY', tone: 'warning' },
        },
        { label: 'Net financing flow', value: quarterly ? '−6,950' : '−31,470' },
      ],
    },
    {
      id: 'cf-free-cash',
      title: 'Free cash flow',
      subtitle: `${scope} · ₹ crore`,
      stats: [
        {
          label: 'Free cash flow',
          value: quarterly ? '10,830' : '41,600',
          delta: { label: quarterly ? '−3.4% QoQ' : '+18.9% YoY', tone: quarterly ? 'critical' : 'good' },
        },
        { label: 'FCF conversion', value: quarterly ? '33.4%' : '32.3%' },
      ],
      footnote: 'Placeholder figures — not sourced from any filing.',
    },
  ]
}

export function kpiWidgets(): PlaceholderWidget[] {
  return [
    {
      id: 'kpi-returns',
      title: 'Return ratios',
      subtitle: 'Trailing twelve months',
      badge: 'Sample',
      stats: [
        { label: 'Return on equity', value: '18.6%', delta: { label: '+120 bps YoY', tone: 'good' } },
        { label: 'Return on capital employed', value: '14.2%', delta: { label: '+60 bps YoY', tone: 'good' } },
      ],
    },
    {
      id: 'kpi-valuation',
      title: 'Valuation',
      subtitle: 'As reported by the source',
      stats: [
        { label: 'Price to earnings', value: '24.8x', delta: { label: '−1.4x YoY', tone: 'good' } },
        { label: 'Price to book', value: '3.1x' },
      ],
      footnote: 'Placeholder figures — not sourced from any filing.',
    },
    {
      id: 'kpi-peers',
      title: 'Peer comparison',
      subtitle: 'Sector cohort',
      wide: true,
      stats: [],
      empty: {
        message: 'Peer set not available',
        hint: 'Peer comparison is scheduled for a later phase, once more than one company has ingested data.',
      },
    },
  ]
}
