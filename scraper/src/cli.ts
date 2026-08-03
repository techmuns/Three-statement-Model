/**
 * CLI entry point.
 *
 *   npm run scrape -- --company=RELIANCE   # one company
 *   npm run scrape:all                     # every configured company
 *
 * Logs in once, reuses the context across companies, pauses between page loads
 * to stay a polite scraper, and reports each company's outcome. A company that
 * fails to parse is reported loudly (company + statement + reason) and its file
 * is not written — no silent partial output. The process exits non-zero if any
 * company failed.
 */

import { parseArgs } from 'node:util'
import { launchBrowser, createLoggedInContext } from './browser'
import { SCRAPER_COMPANIES, findScraperCompany, type ScraperCompany } from './companies'
import { readCredentials } from './env'
import { writeCompanyFile } from './output'
import { scrapeCompany } from './scrape'

/** Polite pause between company page loads. */
const DELAY_MS = 2_500

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function usage(message: string): never {
  console.error(message)
  console.error('Usage: npm run scrape -- --company=<SYMBOL>   |   npm run scrape:all')
  console.error(`Symbols: ${SCRAPER_COMPANIES.map((c) => c.screenerSymbol).join(', ')}`)
  process.exit(1)
}

function resolveTargets(): readonly ScraperCompany[] {
  const { values } = parseArgs({
    options: { company: { type: 'string' }, all: { type: 'boolean' } },
    allowPositionals: false,
  })

  if (values.all) return SCRAPER_COMPANIES
  if (values.company) {
    const company = findScraperCompany(values.company)
    if (!company) usage(`Unknown company: ${values.company}`)
    return [company]
  }
  usage('Specify --company=<SYMBOL> or --all.')
}

async function main(): Promise<void> {
  const targets = resolveTargets()
  const credentials = readCredentials() // Throws loudly if unset.

  const browser = await launchBrowser()
  const failures: string[] = []
  try {
    const context = await createLoggedInContext(browser, credentials)
    console.log(`Logged in. Scraping ${targets.length} compan${targets.length === 1 ? 'y' : 'ies'}…`)

    for (let i = 0; i < targets.length; i++) {
      const company = targets[i]
      console.log(`→ ${company.screenerSymbol} (${company.name})`)
      try {
        const financials = await scrapeCompany(context, company)
        const file = await writeCompanyFile(company.screenerSymbol, financials)
        console.log(
          `✓ ${company.screenerSymbol}: ${financials.statementLayout} layout, ` +
            `${financials.source.basis} basis → ${file}`,
        )
      } catch (error) {
        failures.push(company.screenerSymbol)
        console.error(`✗ ${(error as Error).message}`)
      }
      if (i < targets.length - 1) await sleep(DELAY_MS)
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
