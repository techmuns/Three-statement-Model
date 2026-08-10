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
import { bseScripCodeFor } from './companies'
import { fetchCompanySegmentMix } from './bse/companySegments'
import {
  detectBasis,
  extractBseScripCode,
  extractPeersTable,
  extractSection,
  preparePage,
  SECTION_IDS,
} from './extract'
import { normalizeCompany } from './normalize'
import { mapPeersTable, type ScrapedPeer } from './peers'

export interface CompanyScrape {
  readonly financials: CompanyFinancials
  /** Peers read from this company's Screener peer table, empty if unreadable. */
  readonly peers: readonly ScrapedPeer[]
  /** Set when the peer table couldn't be read; the financials are unaffected. */
  readonly peerError: string | null
  /** What the peer table actually exposed (headers + mapped KPIs), for logging. */
  readonly peerColumns: string | null
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
    let peerColumns: string | null = null
    await page
      .waitForSelector('#peers table.data-table', { timeout: 20_000 })
      .catch(() => undefined)
    const rawPeers = await extractPeersTable(page)
    if (!rawPeers) {
      peerError = `${company.screenerSymbol} · peers: table not found or not loaded on page`
    } else {
      // Column detection never throws: whatever KPIs the table exposes are
      // mapped, the rest are left null. Record what was found for the log.
      const mapped = mapPeersTable(rawPeers)
      peers = mapped.peers
      peerColumns =
        `${mapped.peers.length} peers · headers [${mapped.headers.join(' | ')}] · ` +
        `market-cap ${mapped.hasMarketCap ? 'yes' : 'no'} · ` +
        `KPIs mapped [${mapped.mappedKpis.join(', ') || 'none'}]`
    }

    // Best-effort quarterly segment mix from the company's BSE filings. Never
    // allowed to break the statements scrape — any failure keeps the honest
    // "not reported" state that normalize already set.
    let withSegments = financials
    try {
      const scrip = (await extractBseScripCode(page)) ?? bseScripCodeFor(company.companyId) ?? null
      if (scrip) {
        const quarterlyIds =
          financials.quarterly.profitLoss.status === 'available'
            ? financials.quarterly.profitLoss.periods.map((p) => p.period.id)
            : []
        const segmentMix = await fetchCompanySegmentMix(scrip, quarterlyIds)
        if (segmentMix) {
          withSegments = { ...financials, quarterly: { ...financials.quarterly, segmentMix } }
        }
      }
    } catch {
      // Segment mix stays as normalize left it.
    }

    // Store the company's own peer list (identity only) so the dashboard can
    // derive each peer's KPIs from that peer's statements — this scales peer
    // comparison to any company, not just the seeded sector groups.
    const peerRefs = peers.map((p) => ({
      symbol: p.symbol,
      name: p.name,
      marketCapCrore: p.marketCapCrore,
    }))
    const financialsOut: CompanyFinancials =
      peerRefs.length > 0 ? { ...withSegments, peers: peerRefs } : withSegments

    return { financials: financialsOut, peers, peerError, peerColumns }
  } finally {
    await page.close()
  }
}
