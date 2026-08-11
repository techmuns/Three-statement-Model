/**
 * Discovering a company's latest BSE Reg-33 "Financial Results" filings.
 *
 * BSE's announcement API (`api.bseindia.com`) is the natural index of a
 * company's filings, but it sits behind an Akamai bot-manager that blocks
 * datacenter clients — which is why the segment fetcher previously required
 * filing URLs to be passed in by hand. We route the API call through
 * **Scrape.do** (a proxy/anti-bot service, key in `SCRAPEDO_API_KEY`), which
 * fetches from a residential IP and returns the JSON, so discovery becomes
 * automatic.
 *
 * The call is made with `curl` for the same reason the attachment download is:
 * it honours the sandbox `HTTPS_PROXY` and is present in CI. Everything here is
 * best-effort — any failure returns an empty list and the caller keeps the
 * honest "segment mix not reported" state rather than guessing.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const BSE_ATTACH_BASE = 'https://www.bseindia.com/xml-data/corpfiling/AttachLive/'

function yyyymmdd(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
}

/** Wrap a target URL in a Scrape.do request. `super`/`geoCode` route it through
 * a residential India IP, which is what gets past BSE's bot manager. */
function scrapeDoUrl(target: string, token: string): string {
  const params = new URLSearchParams({
    token,
    url: target,
    super: (process.env.SCRAPEDO_SUPER ?? 'true').trim(),
    geoCode: (process.env.SCRAPEDO_GEOCODE ?? 'in').trim(),
  })
  if ((process.env.SCRAPEDO_RENDER ?? '').trim() === 'true') params.set('render', 'true')
  return `https://api.scrape.do/?${params.toString()}`
}

interface AnnouncementRow {
  ATTACHMENTNAME?: string
  NEWSSUB?: string
  CATEGORYNAME?: string
}

/** A results-statement announcement (has "Result" in its category/subject). */
function isResultAnnouncement(row: AnnouncementRow): boolean {
  const cat = (row.CATEGORYNAME ?? '').toLowerCase()
  const sub = (row.NEWSSUB ?? '').toLowerCase()
  return cat.includes('result') || /result/.test(sub)
}

/**
 * The URLs of a company's most recent results-statement PDFs (newest first),
 * up to `limit`. Each filing covers three quarters, so two is enough for a
 * five-quarter window. Empty when Scrape.do isn't configured or nothing is
 * found.
 */
export async function discoverResultFilings(scripCode: string, limit = 2): Promise<string[]> {
  const token = process.env.SCRAPEDO_API_KEY?.trim()
  if (!token) return []

  const now = new Date()
  const oneYearAgo = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000)
  // strCat=-1 (all categories) is more robust than a specific category string;
  // we filter for results-statements in code below.
  const api =
    `https://api.bseindia.com/BseIndiaAPI/api/AnnGetData/w?pageno=1&strCat=-1` +
    `&strPrevDate=${yyyymmdd(oneYearAgo)}&strScrip=${encodeURIComponent(scripCode)}` +
    `&strSearch=P&strToDate=${yyyymmdd(now)}&strType=C`

  let body: string
  try {
    const { stdout } = await run(
      'curl',
      ['--silent', '--show-error', '--location', '--max-time', '90', scrapeDoUrl(api, token)],
      { maxBuffer: 8 * 1024 * 1024 },
    )
    body = stdout
  } catch (err) {
    console.error(`  ! BSE discovery: Scrape.do request failed for scrip ${scripCode}: ${(err as Error).message}`)
    return []
  }

  let rows: AnnouncementRow[]
  try {
    const parsed = JSON.parse(body) as { Table?: AnnouncementRow[] }
    rows = Array.isArray(parsed.Table) ? parsed.Table : []
  } catch {
    console.error(
      `  ! BSE discovery: non-JSON response for scrip ${scripCode} (likely blocked). First 140 chars: ` +
        body.slice(0, 140).replace(/\s+/g, ' '),
    )
    return []
  }

  const urls: string[] = []
  for (const row of rows) {
    const attachment = row.ATTACHMENTNAME?.trim()
    if (!attachment || !/\.pdf$/i.test(attachment)) continue
    if (!isResultAnnouncement(row)) continue
    urls.push(`${BSE_ATTACH_BASE}${attachment}`)
    if (urls.length >= limit) break
  }
  console.log(`  · BSE discovery: ${rows.length} announcements, ${urls.length} results-PDF(s) for scrip ${scripCode}`)
  // When nothing matched, surface a snippet of the raw response so we can tell a
  // genuinely empty result from a Scrape.do error / block.
  if (urls.length === 0) {
    console.log(`  · BSE discovery raw (first 300): ${body.slice(0, 300).replace(/\s+/g, ' ')}`)
  }
  return urls
}
