import { APP } from '@/config/app'
import { cn } from '@/lib/cn'
import { formatUpdatedAt, isLiveSource } from '@/lib/provenance'
import { getCompanyDataSource } from '@/mocks/financials'

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
  const live = source !== null && isLiveSource(source) ? source : null

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
      {live ? `Live · updated ${formatUpdatedAt(live.fetchedAt)}` : APP.dataStage}
    </span>
  )
}
