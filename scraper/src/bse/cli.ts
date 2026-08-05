/**
 * Standalone BSE segment-revenue fetcher.
 *
 *   npm run scrape:bse-segments -- --company=RELIANCE \
 *     --filing=<bse-attachment-url> [--filing=<older-results-statement-url> ...]
 *
 * Deliberately separate from the scheduled Screener rotation: it fills only the
 * segment-revenue gap Screener does not publish, by reading BSE's Reg-33
 * "Financial Results" statements. Pass the most recent results-statement PDF
 * first; add the preceding one to complete a five-quarter window (each filing
 * covers three quarters). It rewrites only the `segmentMix` of an existing
 * `data/<SYMBOL>.json`, leaving the Screener-sourced statements untouched.
 *
 * BSE's announcement API — the natural way to discover the latest filing URL —
 * is Akamai-gated against datacenter clients, so filing URLs are passed in for
 * now; the reachable static filing host is what this script fetches from.
 */

import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bseScripCodeFor, findScraperCompany } from '../companies'
import { downloadFiling } from './download'
import { buildSegmentMix } from './normalize'
import { extractSegments, type SegmentTable } from './segments'

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data')
const POLITE_DELAY_MS = 2500

function parseArgs(argv: readonly string[]): { company: string; filings: string[] } {
  let company = ''
  const filings: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const take = (flag: string) =>
      arg.startsWith(`${flag}=`) ? arg.slice(flag.length + 1) : arg === flag ? argv[++i] : null
    const c = take('--company')
    if (c) company = c
    const f = take('--filing')
    if (f) filings.push(f)
  }
  return { company, filings }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const { company, filings } = parseArgs(process.argv.slice(2))
  if (!company || filings.length === 0) {
    throw new Error('usage: --company=<SYMBOL> --filing=<url> [--filing=<url> ...]')
  }

  const scraperCompany = findScraperCompany(company)
  if (!scraperCompany) throw new Error(`unknown company: ${company}`)
  const scripCode = bseScripCodeFor(scraperCompany.companyId)
  if (!scripCode) throw new Error(`no bseScripCode in registry for ${scraperCompany.companyId}`)

  const symbol = scraperCompany.companyId
  const filePath = path.join(dataDir, `${symbol}.json`)
  const financials = JSON.parse(await readFile(filePath, 'utf8'))

  console.log(`BSE segments · ${scraperCompany.name} (${symbol}, scrip ${scripCode})`)

  const tmp = await mkdtemp(path.join(tmpdir(), 'bse-'))
  const tables: SegmentTable[] = []
  let singleSegmentNote: string | null = null

  for (const [index, url] of filings.entries()) {
    if (index > 0) await delay(POLITE_DELAY_MS)
    const dest = path.join(tmp, `filing-${index}.pdf`)
    console.log(`  ↓ ${url}`)
    await downloadFiling(url, dest)
    const extraction = await extractSegments(dest)
    if (extraction.kind === 'single') {
      singleSegmentNote = extraction.note
      console.log(`  · ${extraction.note}`)
      break
    }
    const t = extraction.table
    console.log(
      `  · ${t.quarterEndISO}: ${t.segments.map((s) => `${s.name} ${s.revenueByColumn[0].toLocaleString('en-IN')}`).join(' · ')} (gross ${t.grossByColumn[0].toLocaleString('en-IN')})`,
    )
    tables.push(t)
  }

  const timestamp = new Date().toISOString()

  // A genuine single-segment filer has no mix to show — represented as
  // "not reported", not an error or missing data.
  if (singleSegmentNote) {
    financials.quarterly.segmentMix = { status: 'unavailable', reason: 'not-reported', note: singleSegmentNote }
    financials.annual.segmentMix = { status: 'unavailable', reason: 'not-reported', note: singleSegmentNote }
    await writeFile(filePath, `${JSON.stringify(financials, null, 2)}\n`, 'utf8')
    console.log('  ✓ recorded single-segment status')
    return
  }

  const quarterlyIds: string[] = (financials.quarterly.profitLoss.periods ?? []).map(
    (p: { period: { id: string } }) => p.period.id,
  )
  const build = buildSegmentMix(tables, quarterlyIds)

  const latestId = quarterlyIds[quarterlyIds.length - 1]
  if (!build.coveredPeriodIds.includes(latestId)) {
    throw new Error(
      `no segment data for the latest quarter (${latestId}) — pass its results statement as the first --filing`,
    )
  }

  financials.quarterly.segmentMix = { status: 'available', segments: build.segments }
  // Annual segment history needs a back-run of older annual filings; until then
  // it stays honestly unavailable rather than partly filled.
  financials.annual.segmentMix = {
    status: 'unavailable',
    reason: 'not-scraped',
    note: `Quarterly segment mix is sourced from BSE Reg-33 Financial Results filings (scrip ${scripCode}); annual segment history is not yet back-filled.`,
  }

  await writeFile(filePath, `${JSON.stringify(financials, null, 2)}\n`, 'utf8')
  console.log(
    `  ✓ wrote quarterly segment mix for ${build.coveredPeriodIds.length}/${quarterlyIds.length} periods (${build.coveredPeriodIds.join(', ')}) → ${path.relative(process.cwd(), filePath)}`,
  )
  if (build.missingPeriodIds.length > 0) {
    console.warn(
      `  ! pending: ${build.missingPeriodIds.join(', ')} — add the preceding results statement with another --filing to fill them`,
    )
  }
}

main().catch((error) => {
  console.error(`bse-segments failed: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
