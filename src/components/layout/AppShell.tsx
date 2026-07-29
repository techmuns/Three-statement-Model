import type { ReactNode } from 'react'
import { APP } from '@/config/app'

const MAIN_ID = 'main-content'

/**
 * Page frame: skip link, sticky header slot, the scrolling main region, and
 * the footer.
 *
 * The document scrolls normally (rather than an inner scroll container) so the
 * browser's own scroll restoration and find-in-page behave as users expect on
 * a standalone site.
 */
export function AppShell({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface-page bg-gradient-page-wash bg-fixed">
      <a
        href={`#${MAIN_ID}`}
        className="sr-only rounded-control bg-surface-card px-4 py-2 text-title font-semibold text-brand-700 shadow-overlay focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to main content
      </a>

      {header}

      <main id={MAIN_ID} className="mx-auto w-full max-w-[110rem] px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-[110rem] px-4 pb-8 sm:px-6">
        <p className="border-t border-line-hairline pt-4 text-caption text-ink-subtle">
          {APP.name} · {APP.tagline}. Every figure on this screen is placeholder data for layout
          purposes and must not be used for investment decisions.
        </p>
      </footer>
    </div>
  )
}
