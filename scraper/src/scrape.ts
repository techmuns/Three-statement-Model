/**
 * Scraping one company: navigate to its Screener page, read the statement
 * sections, and normalise them into `CompanyFinancials`.
 *
 * Prefers the consolidated view (Screener falls back to standalone for
 * companies that don't file consolidated, which `detectBasis` then records
 * accurately). A missing statement section surfaces as a loud error from
 * `normalizeCompany` rather than silent partial output.
 *
 * ── Fragile page-structure assumption ──
 *   • A company page lives at
 *     https://www.screener.in/company/<symbol>/consolidated/ and renders the
 *     `#profit-loss` table once loaded.
 */

import type { BrowserContext } from 'playwright'
import type { CompanyFinancials } from '../../src/types/financials'
import type { ScraperCompany } from './companies'
import { detectBasis, extractPeersTable, extractSection, preparePage, SECTION_IDS } from './extract'
import { normalizeCompany } from './normalize'
import { mapPeersTable, type ScrapedPeer } from './peers'

export interface CompanyScrape {
  readonly financials: CompanyFinancials
  /** Peers read from this company's Screener peer table, empty if unreadable. */
  readonly peers: readonly ScrapedPeer[]
  /** Set when the peer table couldn't be read; the financials are unaffected. */
  readonly peerError: string | null
}

function companyUrl(symbol: string): string {
  return `https://www.screener.in/company/${symbol}/consolidated/`
}

export async function scrapeCompany(
  context: BrowserContext,
  company: ScraperCompany,
): Promise<CompanyScrape> {
  const page = await context.newPage()
  try {
    await page.goto(companyUrl(company.screenerSymbol), {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    // The statement tables render server-side; wait for the P&L one to exist.
    await page
      .waitForSelector(`#${SECTION_IDS.profitLoss} table.data-table`, { timeout: 30_000 })
      .catch(() => undefined) // A genuine miss becomes a loud error in normalize.

    await preparePage(page)
    const basis = await detectBasis(page)
    const [quarters, profitLoss, balanceSheet, cashFlow] = await Promise.all([
      extractSection(page, SECTION_IDS.quarters),
      extractSection(page, SECTION_IDS.profitLoss),
      extractSection(page, SECTION_IDS.balanceSheet),
      extractSection(page, SECTION_IDS.cashFlow),
    ])

    const financials = normalizeCompany(
      company,
      { quarters, profitLoss, balanceSheet, cashFlow },
      basis,
      page.url(),
      new Date().toISOString(),
    )

    // Peers load asynchronously into #peers-table-placeholder after the page
    // settles. Best-effort: a peer-table miss is reported but never discards the
    // financials, which are the primary deliverable.
    let peers: readonly ScrapedPeer[] = []
    let peerError: string | null = null
    await page
      .waitForSelector('#peers table.data-table', { timeout: 20_000 })
      .catch(() => undefined)
    const rawPeers = await extractPeersTable(page)
    if (!rawPeers) {
      peerError = `${company.screenerSymbol} · peers: table not found or not loaded on page`
    } else {
      try {
        peers = mapPeersTable(rawPeers, company.screenerSymbol)
      } catch (error) {
        peerError = (error as Error).message
      }
    }

    return { financials, peers, peerError }
  } finally {
    await page.close()
  }
}
