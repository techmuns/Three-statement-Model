/**
 * Discovering a company's BSE "Financial Results" filings via BSE's own
 * announcement API — called from inside a real browser page.
 *
 * `api.bseindia.com` sits behind an Akamai bot-manager: a bare curl (or a
 * scraping proxy) gets a 200 with a decoy `"No Record Found!"`. A real Chromium
 * that has loaded a bseindia.com page first has solved Akamai's JS challenge and
 * holds the `_abck`/`bm_sz` cookies, so a same-site `fetch()` from that page
 * returns the genuine JSON. We reuse the scrape's browser context for exactly
 * that. Everything is best-effort: any block/parse failure returns `[]` and the
 * caller keeps the honest "segment not reported" state.
 *
 * The results statement PDFs live on the static host
 * (`www.bseindia.com/xml-data/corpfiling/AttachLive/<file>`), which serves them
 * to a plain download (see download.ts) — only the *index* API was ever gated.
 */

import type { BrowserContext } from 'playwright'

const ATTACH_BASE = 'https://www.bseindia.com/xml-data/corpfiling/AttachLive/'

export interface BseResultFiling {
  readonly url: string
  readonly subject: string
}

interface AnnRow {
  ATTACHMENTNAME?: string
  NEWSSUB?: string
  HEADLINE?: string
  CATEGORYNAME?: string
  SUBCATNAME?: string
}

function yyyymmdd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

/** A results-statement announcement (its category/sub-category says "Result"). */
function isResult(row: AnnRow): boolean {
  const cat = `${row.CATEGORYNAME ?? ''} ${row.SUBCATNAME ?? ''}`.toLowerCase()
  const sub = `${row.NEWSSUB ?? ''} ${row.HEADLINE ?? ''}`.toLowerCase()
  return /result/.test(cat) || /financial result|results for the quarter/.test(sub)
}

/**
 * The company's most recent results-filing PDF URLs (newest first, up to
 * `limit`). Each quarterly filing carries three quarters, so two covers a
 * five-quarter window.
 */
export async function fetchBseResultFilings(
  context: BrowserContext,
  scripCode: string,
  limit = 2,
): Promise<BseResultFiling[]> {
  const page = await context.newPage()
  try {
    // Load a real BSE page so Akamai issues valid cookies for this context.
    await page
      .goto('https://www.bseindia.com/corporates/ann.html', { waitUntil: 'domcontentloaded', timeout: 45_000 })
      .catch(() => undefined)
    await page.waitForTimeout(4_000)

    const now = new Date()
    const from = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000)
    const api =
      `https://api.bseindia.com/BseIndiaAPI/api/AnnGetData/w?pageno=1&strCat=-1` +
      `&strPrevDate=${yyyymmdd(from)}&strScrip=${encodeURIComponent(scripCode)}` +
      `&strSearch=P&strToDate=${yyyymmdd(now)}&strType=C`

    const raw: string = await page.evaluate(async (url) => {
      try {
        const r = await fetch(url, {
          credentials: 'include',
          headers: { Accept: 'application/json, text/plain, */*' },
        })
        return await r.text()
      } catch (e) {
        return `FETCH-ERR ${(e as Error).message}`
      }
    }, api)

    // Diagnostic: the first run tells us the true response shape / any block.
    console.log(`      BSE ann API (scrip ${scripCode}): ${raw.slice(0, 160).replace(/\s+/g, ' ')}`)

    let parsed: { Table?: AnnRow[] } | null = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
    const rows = Array.isArray(parsed?.Table) ? parsed.Table : []

    const out: BseResultFiling[] = []
    for (const row of rows) {
      const attach = row.ATTACHMENTNAME?.trim()
      if (!attach || !/\.pdf$/i.test(attach)) continue
      if (!isResult(row)) continue
      out.push({ url: `${ATTACH_BASE}${attach}`, subject: (row.NEWSSUB ?? row.HEADLINE ?? '').trim() })
      if (out.length >= limit) break
    }
    console.log(`      BSE ann API: ${rows.length} announcement(s), ${out.length} results filing(s)`)
    return out
  } finally {
    await page.close()
  }
}
