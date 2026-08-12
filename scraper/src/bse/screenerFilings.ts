/**
 * Discovering a company's BSE results-filing PDFs straight from the Screener
 * company page we already load during a scrape.
 *
 * Screener embeds BSE attachment links (…/corpfiling/AttachHis|AttachLive/<id>.pdf
 * and …/stockinfo/AnnPdfOpen.aspx?Pname=<id>.pdf) in its Documents / Announcements
 * sections, so we read them off the logged-in DOM — no Akamai-gated BSE API
 * needed. The static filing host serves those PDFs directly (see download.ts),
 * and the SEBI quarterly-results format is what segments.ts parses. Everything
 * here is best-effort: no link, no segment mix, and the honest "not reported"
 * state stands.
 */

import type { Page } from 'playwright'

export interface FilingLink {
  readonly url: string
  readonly label: string
}

/** Every BSE attachment link on the page, de-duped, in document order. */
export async function collectBseFilingLinks(page: Page): Promise<FilingLink[]> {
  return page.evaluate(() => {
    const RE =
      /bseindia\.com\/(?:xml-data\/corpfiling\/(?:AttachHis|AttachLive)|stockinfo\/AnnPdfOpen)/i
    const seen = new Set<string>()
    const out: { url: string; label: string }[] = []
    for (const a of Array.from(document.querySelectorAll('a[href]'))) {
      const url = (a as HTMLAnchorElement).href
      if (!RE.test(url) || seen.has(url)) continue
      seen.add(url)
      const own = (a.textContent || '').replace(/\s+/g, ' ').trim()
      const row = a.closest('tr, li')
      const rowText = row ? (row.textContent || '').replace(/\s+/g, ' ').trim() : ''
      out.push({ url, label: own || rowText.slice(0, 90) })
    }
    return out
  })
}

// A results statement announces the board-approved financials for the period.
const RESULT_RE = /result|board meeting|outcome|integrated filing|unaudited|financial result/i
// Concall decks, transcripts, annual reports, ratings etc. are not the statement.
const NOT_RESULT_RE =
  /transcript|ppt|presentation|concall|annual report|financial year|newspaper|rating|investor meet|analyst|dividend|voting/i

/**
 * The subset of links whose label looks like a quarterly results statement,
 * newest first (page order), capped so we download at most a couple of PDFs.
 */
export function resultFilingCandidates(links: readonly FilingLink[], limit = 3): FilingLink[] {
  return links
    .filter((l) => RESULT_RE.test(l.label) && !NOT_RESULT_RE.test(l.label))
    .slice(0, limit)
}
