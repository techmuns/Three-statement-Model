import { PageToolbar } from '@/components/layout/PageToolbar'
import { SegmentedControl } from '@/components/nav/SegmentedControl'
import { WIDGET_STATES, type WidgetState } from '@/components/widgets/widgetState'
import { kpiWidgets } from '@/mocks/placeholders'
import type { MockCompany } from '@/mocks/companies'
import { WidgetDeck } from '@/views/shared/WidgetDeck'

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

      <WidgetDeck widgets={kpiWidgets()} state={widgetState} />
    </>
  )
}
