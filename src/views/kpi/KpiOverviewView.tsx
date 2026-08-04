import { PageToolbar } from '@/components/layout/PageToolbar'
import type { MockCompany } from '@/mocks/companies'
import { KpiOverviewPanel } from './KpiOverviewPanel'

export interface KpiOverviewViewProps {
  company: MockCompany
}

export function KpiOverviewView({ company }: KpiOverviewViewProps) {
  return (
    <>
      <PageToolbar
        title={`${company.name} · KPI Overview`}
        description={`${company.ticker} · ${company.sector}`}
      />

      <KpiOverviewPanel company={company} />
    </>
  )
}
