export interface AnnualOnlyNoticeProps {
  /** The statement, as a reader sees it, e.g. `Balance sheet` or `Cash flow`. */
  statement: string
  /** Why it is annual-only. Defaults to the SEBI/Screener explanation; pass the
   * data's own `note` where there is one so the wording tracks the source. */
  note?: string
}

const DEFAULT_NOTE =
  'Indian filers report it half-yearly at the earliest, and Screener publishes annual columns only.'

/**
 * A non-blocking notice shown above the balance sheet and cash flow decks when
 * the period toggle is set to quarterly.
 *
 * These two statements genuinely do not exist at quarterly cadence for Indian
 * listed companies. Rather than repeat a "not available" empty state on every
 * card of the tab, the tab says once — here — that it is annual-only, and then
 * renders the real annual figures below regardless of the toggle. This is a
 * notice, not an empty state: it explains the data, it never replaces it.
 *
 * Shared by both sub-tabs so the explanation, wording and treatment stay in one
 * place; `statement` is the only thing that differs between them.
 */
export function AnnualOnlyNotice({ statement, note = DEFAULT_NOTE }: AnnualOnlyNoticeProps) {
  return (
    <div
      role="note"
      className="mb-5 flex items-start gap-3 rounded-card border border-brand-100 bg-brand-50 px-4 py-3"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"
      >
        <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-body font-semibold text-ink-primary">
          {statement} is reported annually only
        </p>
        <p className="mt-0.5 text-caption text-ink-secondary">
          {note} Showing the last 5 financial years.
        </p>
      </div>
    </div>
  )
}
