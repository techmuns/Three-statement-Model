/**
 * The standard equity-analysis KPI set.
 *
 * Definitions rather than data: these survive the move to real scraped
 * figures, which is why they sit in `config/` beside the navigation
 * definitions rather than in `mocks/`.
 */

import type { KpiDefinition, KpiId } from '@/types/kpi'

export const KPI_DEFINITIONS: readonly KpiDefinition[] = [
  {
    id: 'revenue-growth',
    label: 'Revenue Growth',
    shortLabel: 'Rev. growth',
    unit: 'percent',
    direction: 'higher-is-better',
    formula: 'Sales this year ÷ sales last year − 1',
    precision: 1,
    description: 'Year-on-year change in reported sales. Undefined for the first year held.',
  },
  {
    id: 'operating-margin',
    label: 'Operating Margin',
    shortLabel: 'OPM',
    unit: 'percent',
    direction: 'higher-is-better',
    formula: 'Operating profit ÷ sales',
    precision: 1,
    description:
      'Profitability of the core business before interest, depreciation and tax. Reported as Financing Margin % for banks.',
  },
  {
    id: 'net-profit-margin',
    label: 'Net Profit Margin',
    shortLabel: 'NPM',
    unit: 'percent',
    direction: 'higher-is-better',
    formula: 'Net profit ÷ sales',
    precision: 1,
    description: 'Share of every rupee of sales that reaches the bottom line.',
  },
  {
    id: 'return-on-equity',
    label: 'Return on Equity',
    shortLabel: 'ROE',
    unit: 'percent',
    direction: 'higher-is-better',
    formula: 'Net profit ÷ (equity capital + reserves)',
    precision: 1,
    description: "Return generated on shareholders' own funds.",
  },
  {
    id: 'return-on-capital-employed',
    label: 'Return on Capital Employed',
    shortLabel: 'ROCE',
    unit: 'percent',
    direction: 'higher-is-better',
    formula: '(Profit before tax + interest) ÷ (equity capital + reserves + borrowings)',
    precision: 1,
    description:
      'Return on all capital in the business, debt included. Structurally low for lenders, so only compare within a sector.',
  },
  {
    id: 'debt-to-equity',
    label: 'Debt/Equity',
    shortLabel: 'D/E',
    unit: 'ratio',
    direction: 'lower-is-better',
    formula: 'Borrowings ÷ (equity capital + reserves)',
    precision: 2,
    description:
      'Leverage. Structurally high for lenders, where borrowings are raw material rather than risk.',
  },
]

/** Render order for tables and KPI grids. */
export const KPI_IDS: readonly KpiId[] = KPI_DEFINITIONS.map((definition) => definition.id)

export function findKpiDefinition(id: KpiId): KpiDefinition {
  const match = KPI_DEFINITIONS.find((definition) => definition.id === id)
  if (!match) throw new Error(`Unknown KPI: ${id}`)
  return match
}
