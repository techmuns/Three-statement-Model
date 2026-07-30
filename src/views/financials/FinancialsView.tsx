import {
  FINANCIALS_TABS,
  PERIOD_VIEWS,
  type FinancialsTabId,
  type PeriodViewId,
} from '@/config/navigation'
import { PageToolbar } from '@/components/layout/PageToolbar'
import { SegmentedControl } from '@/components/nav/SegmentedControl'
import { TabPanel, Tabs } from '@/components/nav/Tabs'
import { WIDGET_STATES, type WidgetState } from '@/components/widgets/widgetState'
import type { MockCompany } from '@/mocks/companies'
import { ProfitLossPanel } from './ProfitLossPanel'
import { BalanceSheetPanel } from './BalanceSheetPanel'
import { CashFlowPanel } from './CashFlowPanel'

const TAB_ID_PREFIX = 'financials'

export interface FinancialsViewProps {
  company: MockCompany
  statement: FinancialsTabId
  onStatementChange: (statement: FinancialsTabId) => void
  period: PeriodViewId
  onPeriodChange: (period: PeriodViewId) => void
  widgetState: WidgetState
  onWidgetStateChange: (state: WidgetState) => void
}

export function FinancialsView({
  company,
  statement,
  onStatementChange,
  period,
  onPeriodChange,
  widgetState,
  onWidgetStateChange,
}: FinancialsViewProps) {
  const activeStatement = FINANCIALS_TABS.find((tab) => tab.id === statement) ?? FINANCIALS_TABS[0]

  return (
    <>
      <PageToolbar
        title={`${company.name} · Financials`}
        description={`${company.ticker} · ${company.sector}`}
      >
        <SegmentedControl
          label="Period view"
          items={PERIOD_VIEWS}
          value={period}
          onChange={onPeriodChange}
        />
        <SegmentedControl
          label="Preview state"
          showLabel
          items={WIDGET_STATES}
          value={widgetState}
          onChange={onWidgetStateChange}
        />
      </PageToolbar>

      <nav aria-label="Financial statements" className="mb-4">
        <Tabs
          idPrefix={TAB_ID_PREFIX}
          label="Financial statements"
          items={FINANCIALS_TABS}
          value={statement}
          onChange={onStatementChange}
          variant="sub"
        />
      </nav>

      <TabPanel idPrefix={TAB_ID_PREFIX} id={activeStatement.id}>
        {activeStatement.id === 'pl' ? (
          <ProfitLossPanel company={company} period={period} state={widgetState} />
        ) : activeStatement.id === 'balance-sheet' ? (
          <BalanceSheetPanel company={company} period={period} state={widgetState} />
        ) : (
          <CashFlowPanel company={company} period={period} state={widgetState} />
        )}
      </TabPanel>
    </>
  )
}
