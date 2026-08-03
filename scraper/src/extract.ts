/**
 * Reading Screener's statement tables out of the rendered page.
 *
 * Each statement is a `<section id="...">` (`#quarters`, `#profit-loss`,
 * `#balance-sheet`, `#cash-flow`) whose first `table.data-table` has a header
 * row of period columns and one body row per line item. This module pulls those
 * out as raw strings; `normalize.ts` turns them into typed figures.
 *
 * ── Fragile page-structure assumptions (Screener can change these) ──
 *   • Section ids: `quarters`, `profit-loss`, `balance-sheet`, `cash-flow`.
 *   • The statement table is the FIRST `table.data-table` in the section.
 *   • Row 0 cell is the line-item label (with a trailing `+` expand affordance
 *     on expandable rows); the remaining cells align 1:1 with the header
 *     columns after the first (label) header.
 *   • Basis is announced as the text "Consolidated Figures…" /
 *     "Standalone Figures…" somewhere on the page.
 */

import type { Page } from 'playwright'

export interface RawRow {
  readonly label: string
  readonly cells: readonly string[]
}

export interface RawTable {
  /** Column headers; index 0 is the (empty) line-item header. */
  readonly headers: readonly string[]
  readonly rows: readonly RawRow[]
}

export type StatementBasis = 'consolidated' | 'standalone'

/** The Screener section id for each statement table we read. */
export const SECTION_IDS = {
  quarters: 'quarters',
  profitLoss: 'profit-loss',
  balanceSheet: 'balance-sheet',
  cashFlow: 'cash-flow',
} as const

/**
 * Define browser-side helpers our `page.evaluate` callbacks may reference.
 *
 * The tsx runner compiles those callbacks with esbuild's keep-names, which
 * emits a `__name(...)` wrapper; the reference must exist in the page's world
 * for the callback to run. Passed as a string so esbuild leaves it untouched.
 * A no-op under a normal (non-tsx) build. Call once per page before extracting.
 */
export function preparePage(page: Page): Promise<unknown> {
  return page.evaluate('globalThis.__name = globalThis.__name || ((fn) => fn)')
}

/**
 * Extract one statement section's first data-table as raw header/row strings,
 * or `null` if the section or table is absent from the page.
 */
export function extractSection(page: Page, sectionId: string): Promise<RawTable | null> {
  return page.evaluate((id) => {
    const section = document.getElementById(id)
    if (!section) return null
    const table = section.querySelector('table.data-table')
    if (!table) return null

    const clean = (element: Element | null): string =>
      (element?.textContent ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

    const headers = Array.from(table.querySelectorAll('thead th')).map((th) => clean(th))
    const rows = Array.from(table.querySelectorAll('tbody tr')).map((tr) => {
      const tds = Array.from(tr.querySelectorAll('td'))
      // Strip the trailing "+" expand affordance from the label cell.
      const label = clean(tds[0] ?? null).replace(/\s*\+\s*$/, '')
      const cells = tds.slice(1).map((td) => clean(td))
      return { label, cells }
    })

    return { headers, rows }
  }, sectionId)
}

/**
 * Which basis Screener served for this page. Reads the on-page
 * "Consolidated/Standalone Figures…" marker, falling back to the URL shape.
 */
export async function detectBasis(page: Page): Promise<StatementBasis> {
  const text = await page.evaluate(() => document.body.innerText)
  if (/Consolidated\s+Figures/i.test(text)) return 'consolidated'
  if (/Standalone\s+Figures/i.test(text)) return 'standalone'
  return page.url().includes('/consolidated') ? 'consolidated' : 'standalone'
}
