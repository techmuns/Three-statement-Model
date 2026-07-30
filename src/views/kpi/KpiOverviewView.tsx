import { PageToolbar } from '@/components/layout/PageToolbar'
import { SegmentedControl } from '@/components/nav/SegmentedControl'
import { WIDGET_STATES, type WidgetState } from '@/components/widgets/widgetState'
import type { MockCompany } from '@/mocks/companies'
import { KpiOverviewPanel } from './KpiOverviewPanel'

export interface KpiOverviewViewProps {
  company: MockCompany
  widgetState: WidgetState
  onWidgetStateChange: (state: WidgetState) => void
}

export function KpiOverviewView({
  company,
  widgetState,
  onWidgetStateChange,
}: KpiOverviewViewProps) {
  return (
    <>
      <PageToolbar
        title={`${company.name} · KPI Overview`}
        description={`${company.ticker} · ${company.sector}`}
      >
        <SegmentedControl
          label="Preview state"
          showLabel
          items={WIDGET_STATES}
          value={widgetState}
          onChange={onWidgetStateChange}
        />
      </PageToolbar>

      <KpiOverviewPanel company={company} state={widgetState} />
    </>
  )
}
