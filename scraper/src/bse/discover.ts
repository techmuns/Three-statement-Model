/**
 * Discovering a company's latest BSE Reg-33 "Financial Results" filings.
 *
 * BSE's announcement API (`api.bseindia.com`) is the natural index of a
 * company's filings, but it sits behind an Akamai bot-manager that blocks
 * datacenter clients — which is why the segment fetcher previously required
 * filing URLs to be passed in by hand. We route the API call through
 * **Firecrawl** (`FIRECRAWL_API_KEY`), whose headless-browser scrape executes
 * the Akamai challenge and returns the JSON, so discovery becomes automatic.
 *
 * curl is used (as elsewhere) because it honours the sandbox `HTTPS_PROXY` and
 * is present in CI. Everything here is best-effort — any failure returns an
 * empty list and the caller keeps the honest "segment mix not reported" state.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const BSE_ATTACH_BASE = 'https://www.bseindia.com/xml-data/corpfiling/AttachLive/'
const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v1/scrape'

function yyyymmdd(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
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

/** Pull the outermost JSON object out of possibly HTML-wrapped scrape output. */
function extractJsonObject(text: string): { Table?: AnnouncementRow[] } | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

/**
 * The URLs of a company's most recent results-statement PDFs (newest first),
 * up to `limit`. Each filing covers three quarters, so two is enough for a
 * five-quarter window. Empty when Firecrawl isn't configured or nothing found.
 */
export async function discoverResultFilings(scripCode: string, limit = 2): Promise<string[]> {
  const token = process.env.FIRECRAWL_API_KEY?.trim()
  if (!token) return []

  const now = new Date()
  const from = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000)
  const api =
    `https://api.bseindia.com/BseIndiaAPI/api/AnnGetData/w?pageno=1&strCat=-1` +
    `&strPrevDate=${yyyymmdd(from)}&strScrip=${encodeURIComponent(scripCode)}` +
    `&strSearch=P&strToDate=${yyyymmdd(now)}&strType=C`

  const payload = JSON.stringify({ url: api, formats: ['rawHtml'], waitFor: 2500, timeout: 45000 })

  let stdout: string
  try {
    ;({ stdout } = await run(
      'curl',
      [
        '--silent',
        '--show-error',
        '--location',
        '--max-time',
        '90',
        '-X',
        'POST',
        '-H',
        `Authorization: Bearer ${token}`,
        '-H',
        'Content-Type: application/json',
        '--data',
        payload,
        FIRECRAWL_ENDPOINT,
      ],
      { maxBuffer: 16 * 1024 * 1024 },
    ))
  } catch (err) {
    console.error(`  ! BSE discovery: Firecrawl request failed for scrip ${scripCode}: ${(err as Error).message}`)
    return []
  }

  let content = ''
  try {
    const resp = JSON.parse(stdout) as {
      success?: boolean
      error?: string
      data?: { rawHtml?: string; html?: string; markdown?: string }
    }
    if (!resp.success) {
      console.error(
        `  ! BSE discovery: Firecrawl error for scrip ${scripCode}: ${resp.error ?? 'unknown'} ` +
          `(raw: ${stdout.slice(0, 200).replace(/\s+/g, ' ')})`,
      )
      return []
    }
    content = resp.data?.rawHtml ?? resp.data?.html ?? resp.data?.markdown ?? ''
  } catch {
    console.error(
      `  ! BSE discovery: Firecrawl non-JSON response for scrip ${scripCode}: ${stdout.slice(0, 200).replace(/\s+/g, ' ')}`,
    )
    return []
  }

  const parsed = extractJsonObject(content)
  const rows = parsed && Array.isArray(parsed.Table) ? parsed.Table : []

  const urls: string[] = []
  for (const row of rows) {
    const attachment = row.ATTACHMENTNAME?.trim()
    if (!attachment || !/\.pdf$/i.test(attachment)) continue
    if (!isResultAnnouncement(row)) continue
    urls.push(`${BSE_ATTACH_BASE}${attachment}`)
    if (urls.length >= limit) break
  }
  console.log(`  · BSE discovery (Firecrawl): ${rows.length} announcements, ${urls.length} results-PDF(s) for scrip ${scripCode}`)
  if (urls.length === 0) {
    console.log(`  · BSE discovery raw (first 300): ${content.slice(0, 300).replace(/\s+/g, ' ')}`)
  }
  return urls
}
