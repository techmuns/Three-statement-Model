/**
 * Static placeholder content for the KPI Overview tab.
 *
 * Every number here is invented. The shape below exists only to feed the card
 * layout — it is intentionally not a KPI model. The Financials tab now renders
 * from the real schema; the KPI Overview tab keeps these placeholders until its
 * own phase wires it up, and this file is deleted then.
 */

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
