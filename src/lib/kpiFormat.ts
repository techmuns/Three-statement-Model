/**
 * KPI-aware formatting.
 *
 * A KPI value is rendered by its unit and precision, so the same value array
 * can carry both percentages (margins, returns) and ratios (debt-to-equity)
 * without the call site knowing which is which. These are thin dispatchers over
 * the shared `format.ts` primitives — they add unit awareness, not new number
 * formatting.
 */

import type { Reported } from '@/types/common'
import type { KpiDefinition } from '@/types/kpi'
import { formatPercent, formatRatio } from './format'

/** A KPI value in its own unit and precision; `null` renders as an em dash. */
export function formatKpiValue(value: Reported<number>, definition: KpiDefinition): string {
  return definition.unit === 'percent'
    ? formatPercent(value, definition.precision)
    : formatRatio(value, definition.precision)
}

/**
 * A signed gap between a KPI value and a reference (its peer average), in the
 * KPI's unit. Percentages are compared in **percentage points** — the honest
 * unit for the difference of two percentages — so a margin 3.2 points above the
 * peer average reads `+3.2 pp`, not `+3.2%`. Ratios carry no unit suffix.
 */
export function formatKpiGap(gap: number, definition: KpiDefinition): string {
  const sign = gap > 0 ? '+' : gap < 0 ? '−' : ''
  const magnitude = formatRatio(Math.abs(gap), definition.precision)
  return definition.unit === 'percent' ? `${sign}${magnitude} pp` : `${sign}${magnitude}`
}
