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
import { detectBasis, extractSection, preparePage, SECTION_IDS } from './extract'
import { normalizeCompany } from './normalize'

function companyUrl(symbol: string): string {
  return `https://www.screener.in/company/${symbol}/consolidated/`
}

export async function scrapeCompany(
  context: BrowserContext,
  company: ScraperCompany,
): Promise<CompanyFinancials> {
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

    return normalizeCompany(
      company,
      { quarters, profitLoss, balanceSheet, cashFlow },
      basis,
      page.url(),
      new Date().toISOString(),
    )
  } finally {
    await page.close()
  }
}
