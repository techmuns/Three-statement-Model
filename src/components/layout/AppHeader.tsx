import { PERIOD_VIEWS, PRIMARY_TABS, type PeriodViewId, type PrimaryTabId } from '@/config/navigation'
import { CompanySwitcher } from '@/components/company/CompanySwitcher'
import { SegmentedControl } from '@/components/nav/SegmentedControl'
import { Tabs } from '@/components/nav/Tabs'
import { formatUpdatedAt, isLiveSource } from '@/lib/provenance'
import { basisLabel } from '@/lib/statementLabels'
import type { MockCompany } from '@/mocks/companies'
import { getCompanyDataSource } from '@/mocks/financials'
import { Wordmark } from './Wordmark'

export interface AppHeaderProps {
  company: MockCompany
  onCompanyChange: (company: MockCompany) => void
  primaryTab: PrimaryTabId
  onPrimaryTabChange: (tab: PrimaryTabId) => void
  period: PeriodViewId
  onPeriodChange: (period: PeriodViewId) => void
  /** id prefix shared with the primary tab panels. */
  tabIdPrefix: string
}

/** Export control — present but disabled until the export phase is built. */
function ExportButton({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled
      title={`${label} export — coming soon`}
      aria-label={`${label} export, coming soon`}
      className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-control border border-line-hairline bg-surface-card px-2.5 py-1.5 text-label font-semibold text-ink-muted opacity-70"
    >
      <span aria-hidden="true" className="text-ink-subtle">
        {icon}
      </span>
      {label}
    </button>
  )
}

const DOC_ICON = (
  <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden="true">
    <path d="M4 1.5A1.5 1.5 0 0 0 2.5 3v10A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V6.06a1.5 1.5 0 0 0-.44-1.06l-3.06-3.06a1.5 1.5 0 0 0-1.06-.44H4Zm5 1.31L11.69 5.5H9.5A.5.5 0 0 1 9 5V2.81Z" />
  </svg>
)

/**
 * Persistent compact header: company identity, the period toggle and unit /
 * basis / freshness context, the (not-yet-built) export controls, and the
 * primary tabs. Everything here is app-wide, so the period toggle and freshness
 * follow the user across all three tabs rather than living inside one view.
 */
export function AppHeader({
  company,
  onCompanyChange,
  primaryTab,
  onPrimaryTabChange,
  period,
  onPeriodChange,
  tabIdPrefix,
}: AppHeaderProps) {
  const source = getCompanyDataSource(company.id)
  const freshness = source
    ? isLiveSource(source)
      ? `Updated ${formatUpdatedAt(source.fetchedAt)}`
      : 'Mock data'
    : 'Awaiting data'

  return (
    <header className="sticky top-0 z-20 border-b border-line-hairline bg-surface-header backdrop-blur-md">
      <div aria-hidden="true" className="h-0.5 bg-gradient-accent-rule" />

      <div className="mx-auto w-full max-w-[110rem] px-4 sm:px-6">
        <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          {/* Identity: app wordmark, company picker, and the company's ticker · sector. */}
          <div className="flex min-w-0 items-center gap-3">
            <Wordmark />
            <div className="min-w-0">
              <CompanySwitcher company={company} onSelect={onCompanyChange} />
              <p className="mt-1 truncate pl-1 text-caption text-ink-muted">
                {company.ticker} · {company.sector}
              </p>
            </div>
          </div>

          {/* Controls: period toggle, unit / basis / freshness, export. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:justify-end">
            <SegmentedControl
              label="Period view"
              items={PERIOD_VIEWS}
              value={period}
              onChange={onPeriodChange}
            />

            <div className="flex items-center gap-1.5 text-caption text-ink-muted">
              {source && (
                <span className="rounded-md border border-line-hairline bg-surface-sunken px-1.5 py-0.5 font-medium">
                  {basisLabel(source.basis)}
                </span>
              )}
              <span className="rounded-md border border-line-hairline bg-surface-sunken px-1.5 py-0.5 font-medium">
                ₹ Cr
              </span>
              <span
                className={
                  source && isLiveSource(source) ? 'text-status-good' : 'text-ink-subtle'
                }
              >
                {freshness}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <ExportButton label="Excel" icon={DOC_ICON} />
              <ExportButton label="PDF" icon={DOC_ICON} />
            </div>
          </div>
        </div>

        <nav aria-label="Sections">
          <Tabs
            idPrefix={tabIdPrefix}
            label="Dashboard sections"
            items={PRIMARY_TABS}
            value={primaryTab}
            onChange={onPrimaryTabChange}
            variant="primary"
          />
        </nav>
      </div>
    </header>
  )
}
