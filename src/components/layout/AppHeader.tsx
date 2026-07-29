import { APP } from '@/config/app'
import { PRIMARY_TABS, type PrimaryTabId } from '@/config/navigation'
import { CompanySwitcher } from '@/components/company/CompanySwitcher'
import { Tabs } from '@/components/nav/Tabs'
import type { MockCompany } from '@/mocks/companies'
import { Wordmark } from './Wordmark'

export interface AppHeaderProps {
  company: MockCompany
  onCompanyChange: (company: MockCompany) => void
  primaryTab: PrimaryTabId
  onPrimaryTabChange: (tab: PrimaryTabId) => void
  /** id prefix shared with the primary tab panels. */
  tabIdPrefix: string
}

/**
 * Sticky application header: identity, company switcher, primary tabs.
 *
 * On narrow screens the identity row and the switcher stack, and the tablist
 * scrolls horizontally rather than wrapping — so the header height stays
 * predictable and the tabs never reflow mid-interaction.
 */
export function AppHeader({
  company,
  onCompanyChange,
  primaryTab,
  onPrimaryTabChange,
  tabIdPrefix,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-line-hairline bg-surface-header backdrop-blur-md">
      <div aria-hidden="true" className="h-0.5 bg-gradient-accent-rule" />

      <div className="mx-auto w-full max-w-[110rem] px-4 sm:px-6">
        <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="hidden rounded-pill border border-line-hairline bg-surface-sunken px-2 py-0.5 text-micro font-semibold tracking-wide text-ink-muted uppercase md:inline">
              {APP.dataStage}
            </span>
          </div>

          <CompanySwitcher company={company} onSelect={onCompanyChange} />
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
