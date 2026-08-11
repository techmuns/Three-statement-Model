/**
 * CLI entry point.
 *
 *   npm run scrape -- --company=RELIANCE     # one company (any of the ~500)
 *   npm run scrape -- --company=BPCL,IOC     # several, one logged-in session
 *   npm run scrape:rotate                    # the stalest N companies (rotation)
 *   npm run scrape:rotate -- --batch=30      # …with a custom batch size
 *
 * Logs in once, reuses the context across companies, pauses between page loads
 * to stay a polite scraper, and reports each company's outcome. A company that
 * fails to parse is reported loudly (company + statement + reason) and its file
 * is not written — no silent partial output. The process exits non-zero if any
 * company failed.
 *
 * Rotation mode scrapes only the stalest `--batch` companies (default 25) of the
 * full registry, so coverage grows across all ~500 over many runs; see
 * `rotation.ts`.
 */

import { parseArgs } from 'node:util'
import { launchBrowser, createLoggedInContext } from './browser'
import { ROTATION_COMPANIES, resolveScraperCompany, type ScraperCompany } from './companies'
import { readCredentials } from './env'
import { readFetchedAt, writeCompanyFile, writePeerGroupFile } from './output'
import { PEER_GROUP_CONFIG } from './peerGroups'
import { assemblePeerGroups, type ScrapedPeer } from './peers'
import { selectStalest } from './rotation'
import { scrapeCompany } from './scrape'

/** Polite pause between company page loads. Kept short (page loads themselves
 * add several seconds of natural spacing) so a full NIFTY-500 pre-load finishes
 * in a couple of hours rather than many. */
const DELAY_MS = 1_000

/** Default rotation batch size — see the task's slow, safe coverage pace. */
const DEFAULT_BATCH = 25

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function usage(message: string): never {
  console.error(message)
  console.error('Usage: npm run scrape -- --company=<SYMBOL>   |   npm run scrape:rotate [-- --batch=<N>]')
  process.exit(1)
}

function parseBatch(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_BATCH
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) usage(`Invalid --batch: ${raw} (want a positive integer)`)
  return value
}

async function resolveTargets(): Promise<readonly ScraperCompany[]> {
  const { values } = parseArgs({
    options: {
      company: { type: 'string' },
      rotate: { type: 'boolean' },
      batch: { type: 'string' },
    },
    allowPositionals: false,
  })

  if (values.company) {
    // One or more symbols, comma-separated — any listed symbol, registry member
    // or not (see resolveScraperCompany). A list is scraped in a single logged-in
    // session, which is what makes the dashboard's "Run all peers" fast: one run
    // instead of one queued run per peer.
    const symbols = values.company
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (symbols.length === 0) usage('--company was empty (expected one or more symbols).')
    // De-dupe while preserving order, so "BPCL,BPCL" doesn't scrape twice.
    const unique = [...new Set(symbols.map((s) => s.toUpperCase()))]
    return unique.map(resolveScraperCompany)
  }

  if (values.rotate) {
    const batch = parseBatch(values.batch)
    const targets = await selectStalest(ROTATION_COMPANIES, batch, readFetchedAt)
    console.log(
      `Rotation: selected the ${targets.length} stalest of ${ROTATION_COMPANIES.length} active companies ` +
        `(batch ${batch}) — ${targets.map((c) => c.screenerSymbol).join(', ')}`,
    )
    return targets
  }

  usage('Specify --company=<SYMBOL> or --rotate [--batch=<N>].')
}

async function main(): Promise<void> {
  const targets = await resolveTargets()
  const credentials = readCredentials() // Throws loudly if unset.

  const browser = await launchBrowser()
  const failures: string[] = []
  const scrapedPeersByCompany = new Map<string, readonly ScrapedPeer[]>()
  try {
    const context = await createLoggedInContext(browser, credentials)
    console.log(`Logged in. Scraping ${targets.length} compan${targets.length === 1 ? 'y' : 'ies'}…`)

    for (let i = 0; i < targets.length; i++) {
      const company = targets[i]
      console.log(`→ ${company.screenerSymbol} (${company.name})`)
      try {
        const { financials, peers, peerError, peerColumns } = await scrapeCompany(context, company)
        const file = await writeCompanyFile(company.screenerSymbol, financials)
        console.log(
          `✓ ${company.screenerSymbol}: ${financials.statementLayout} layout, ` +
            `${financials.source.basis} basis, ${peers.length} peers → ${file}`,
        )
        scrapedPeersByCompany.set(company.companyId, peers)
        if (peerColumns) console.log(`  · ${company.screenerSymbol} peers: ${peerColumns}`)
        if (peerError) console.error(`  ! ${peerError}`)
      } catch (error) {
        failures.push(company.screenerSymbol)
        console.error(`✗ ${(error as Error).message}`)
      }
      if (i < targets.length - 1) await sleep(DELAY_MS)
    }

    // Assemble the peer groups whose members were scraped this run. Tracked
    // companies (the ones we hold full statements for) are the peer-group
    // members themselves, and are excluded from the carried peer lists.
    const trackedSymbols = new Set(
      PEER_GROUP_CONFIG.flatMap((group) => group.memberCompanyIds.map((id) => id.toUpperCase())),
    )
    const groups = assemblePeerGroups(PEER_GROUP_CONFIG, scrapedPeersByCompany, trackedSymbols)
    for (const group of groups) {
      const file = await writePeerGroupFile(group)
      console.log(`✓ peer group ${group.id}: ${group.peers.length} carried peers → ${file}`)
    }
  } finally {
    await browser.close()
  }

  if (failures.length > 0) {
    console.error(`Finished with ${failures.length} failure(s): ${failures.join(', ')}`)
    process.exit(1)
  }
  console.log('Done.')
}

main().catch((error) => {
  console.error((error as Error).message)
  process.exit(1)
})
