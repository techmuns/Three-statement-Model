import { useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { AppShell } from '@/components/layout/AppShell'
import { TabPanel } from '@/components/nav/Tabs'
import type { WidgetState } from '@/components/widgets/widgetState'
import {
  DEFAULT_FINANCIALS_TAB,
  DEFAULT_PERIOD_VIEW,
  DEFAULT_PRIMARY_TAB,
  type FinancialsTabId,
  type PeriodViewId,
  type PrimaryTabId,
} from '@/config/navigation'
import { DEFAULT_COMPANY_ID, findCompany, type MockCompany } from '@/mocks/companies'
import { FinancialsView } from '@/views/financials/FinancialsView'
import { KpiOverviewView } from '@/views/kpi/KpiOverviewView'

const ROOT_TAB_PREFIX = 'root'

/**
 * All dashboard state lives here for now: plain `useState`, no router and no
 * store. When deep-linking is needed, this is the single place that swaps to
 * URL-derived state — nothing below reads global state directly.
 */
export default function App() {
  const [companyId, setCompanyId] = useState<string>(DEFAULT_COMPANY_ID)
  const [primaryTab, setPrimaryTab] = useState<PrimaryTabId>(DEFAULT_PRIMARY_TAB)
  const [statement, setStatement] = useState<FinancialsTabId>(DEFAULT_FINANCIALS_TAB)
  const [period, setPeriod] = useState<PeriodViewId>(DEFAULT_PERIOD_VIEW)
  const [widgetState, setWidgetState] = useState<WidgetState>('ready')

  const company = findCompany(companyId)

  const handleCompanyChange = (next: MockCompany) => setCompanyId(next.id)

  return (
    <AppShell
      header={
        <AppHeader
          company={company}
          onCompanyChange={handleCompanyChange}
          primaryTab={primaryTab}
          onPrimaryTabChange={setPrimaryTab}
          tabIdPrefix={ROOT_TAB_PREFIX}
        />
      }
    >
      <TabPanel idPrefix={ROOT_TAB_PREFIX} id={primaryTab}>
        {primaryTab === 'financials' ? (
          <FinancialsView
            company={company}
            statement={statement}
            onStatementChange={setStatement}
            period={period}
            onPeriodChange={setPeriod}
            widgetState={widgetState}
            onWidgetStateChange={setWidgetState}
          />
        ) : (
          <KpiOverviewView
            company={company}
            widgetState={widgetState}
            onWidgetStateChange={setWidgetState}
          />
        )}
      </TabPanel>
    </AppShell>
  )
}
