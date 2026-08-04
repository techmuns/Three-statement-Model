import { APP } from '@/config/app'
import { cn } from '@/lib/cn'
import { formatUpdatedAt, isLiveSource } from '@/lib/provenance'
import { getCompanyDataSource } from '@/mocks/financials'

/**
 * Honest, per-company data-source badge shown beside the wordmark.
 *
 * Three states, matching what actually backs the selected company:
 *  - **Live** — real scraped data (`getCompanyFinancials` resolved a scraped file).
 *  - **Mock data** — one of the original companies falling back to authored mock.
 *  - **Awaiting data** — a company in the universe that has not been scraped and
 *    has no authored mock, so its widgets show an "awaiting data" empty state.
 *
 * It takes only the `companyId`, so switching companies re-renders it and it
 * always reflects what is actually on screen.
 */
export function DataSourceBadge({ companyId }: { companyId: string }) {
  const source = getCompanyDataSource(companyId)
  const live = source !== null && isLiveSource(source) ? source : null

  const label = live
    ? `Live · updated ${formatUpdatedAt(live.fetchedAt)}`
    : source !== null
      ? APP.dataStage
      : 'Awaiting data'

  const title = live
    ? `Live data from ${live.provider}${live.url ? ` · ${live.url}` : ''}`
    : source !== null
      ? 'Authored placeholder data — not sourced from any filing'
      : 'Not scraped yet — no data has been ingested for this company'

  return (
    <span
      title={title}
      className={cn(
        'hidden rounded-pill border px-2 py-0.5 text-micro font-semibold tracking-wide uppercase md:inline',
        live
          ? 'border-status-good-soft bg-status-good-soft text-status-good'
          : 'border-line-hairline bg-surface-sunken text-ink-muted',
      )}
    >
      {label}
    </span>
  )
}
