import { APP } from '@/config/app'
import { cn } from '@/lib/cn'
import { getCompanyDataSource } from '@/mocks/financials'

const UPDATED_FORMAT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function formatFetchedAt(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : UPDATED_FORMAT.format(date)
}

/**
 * Honest, per-company data-source badge shown beside the wordmark.
 *
 * Reads the selected company's `DataSource` — the very one `getCompanyFinancials`
 * resolved — and shows **"Live · updated &lt;date&gt;"** when real scraped data is
 * backing the current company, or the mock label when it fell back. It takes
 * only the `companyId`, so switching companies re-renders it and it always
 * reflects what is actually on screen.
 */
export function DataSourceBadge({ companyId }: { companyId: string }) {
  const source = getCompanyDataSource(companyId)
  const live = source !== null && source.provider !== 'mock' ? source : null

  return (
    <span
      title={
        live
          ? `Live data from ${live.provider}${live.url ? ` · ${live.url}` : ''}`
          : 'Authored placeholder data — not sourced from any filing'
      }
      className={cn(
        'hidden rounded-pill border px-2 py-0.5 text-micro font-semibold tracking-wide uppercase md:inline',
        live
          ? 'border-status-good-soft bg-status-good-soft text-status-good'
          : 'border-line-hairline bg-surface-sunken text-ink-muted',
      )}
    >
      {live ? `Live · updated ${formatFetchedAt(live.fetchedAt)}` : APP.dataStage}
    </span>
  )
}
