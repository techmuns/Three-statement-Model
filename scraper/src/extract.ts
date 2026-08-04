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

export interface RawPeerRow {
  /** Screener URL symbol from the row's company link, e.g. `JIOFIN`. */
  readonly symbol: string | null
  readonly name: string
  /** All `<td>` cells, aligned 1:1 with `RawPeerTable.headers`. */
  readonly cells: readonly string[]
}

export interface RawPeerTable {
  readonly headers: readonly string[]
  readonly rows: readonly RawPeerRow[]
}

/**
 * Extract the peer-comparison table, or `null` if it hasn't loaded.
 *
 * Screener injects this table into `#peers-table-placeholder` (inside the
 * `#peers` section) via a client-side request after the page loads, so a caller
 * must wait for it before reading. Unlike the statement tables it has no
 * `thead`/`tbody`: the first `<tr>` (of `<th>`) is the header, and each data
 * row's company link carries the peer's URL symbol.
 *
 * ── Fragile page-structure assumptions ──
 *   • The table is a `table.data-table` under `#peers` /
 *     `#peers-table-placeholder`.
 *   • Row 0 holds the column headers; data rows link to `/company/<symbol>/`.
 */
export function extractPeersTable(page: Page): Promise<RawPeerTable | null> {
  return page.evaluate(() => {
    const section = document.getElementById('peers')
    const table =
      section?.querySelector('table.data-table') ??
      document.querySelector('#peers-table-placeholder table')
    if (!table) return null

    const clean = (element: Element | null): string =>
      (element?.textContent ?? '').replace(/\s+/g, ' ').trim()

    const trs = Array.from(table.querySelectorAll('tr'))
    if (trs.length < 2) return null

    const headers = Array.from(trs[0].querySelectorAll('th, td')).map((cell) => clean(cell))
    const rows = trs
      .slice(1)
      .filter((tr) => tr.querySelector('td'))
      .map((tr) => {
        const link = tr.querySelector('a[href*="/company/"]')
        const href = link?.getAttribute('href') ?? ''
        const match = href.match(/\/company\/([^/]+)/)
        const cells = Array.from(tr.querySelectorAll('td')).map((td) => clean(td))
        return { symbol: match ? match[1] : null, name: clean(link) || (cells[1] ?? ''), cells }
      })

    return { headers, rows }
  })
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
