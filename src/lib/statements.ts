/**
 * Selectors bridging the UI's period toggle to the data layer's cadences.
 */

import type { PeriodViewId } from '@/config/navigation'
import type { CompanyFinancials, StatementSet } from '@/types/financials'
import { PERIOD_VIEW_TO_CADENCE } from '@/types/period'

/** The statement set the period toggle currently selects. */
export function statementSetFor(
  financials: CompanyFinancials,
  periodView: PeriodViewId,
): StatementSet {
  return PERIOD_VIEW_TO_CADENCE[periodView] === 'quarterly'
    ? financials.quarterly
    : financials.annual
}
