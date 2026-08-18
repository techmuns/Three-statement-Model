/**
 * Revenue mix by segment, read from Screener's own segment-results API.
 *
 * Screener has a "Product Segments" table on the P&L and Quarters sections,
 * lazy-loaded from `GET /api/segments/{companyId}/{section}/{segtype}/` (segtype
 * `1` = product segments; `?consolidated=true` for the consolidated view). It
 * returns an HTML fragment: a `data-table` whose `[data-segment-line="Sales"]`
 * group carries each segment's revenue per period. The figures are Premium-gated
 * — logged out, the value area is replaced with an "upgrade to premium" notice —
 * so this only yields numbers because the scraper logs in with a Premium account.
 *
 * We fetch it from inside the logged-in page (same-origin, cookies attached),
 * parse the Sales rows, align each period column to the schema's `PeriodRef.id`
 * (via `parsePeriodHeader`, exactly as the statement tables do), and compute each
 * segment's share of that period's operating-segment total. Inter-segment
 * eliminations ("Less: …") are dropped from the mix so shares sum to 100.
 *
 * Every failure path returns an honest `unavailable` — a company with no segment
 * disclosure (single-segment) simply gets "not reported", never a faked split.
 */

import type { Page } from 'playwright'
import type { PeriodCadence } from '../../src/types/period'
import type { RevenueSegment, SegmentMix, SegmentRevenue } from '../../src/types/financials'
import { parsePeriodHeader } from './periods'
import { parseCell, round } from './numbers'

/** segtype in the endpoint path: 1 = Product Segments. */
const PRODUCT_SEGMENTS = '1'

/** Raw table pulled out of the browser, before schema mapping. */
interface RawSegmentTable {
  ok: boolean
  httpStatus: number
  /** True when the value area shows Screener's Premium upsell instead of figures. */
  paywalled: boolean
  /** Column headers, e.g. `["Mar 2015", …, "Mar 2026"]` (the leading blank dropped). */
  periods: string[]
  /** One entry per segment row, `cells` aligned to `periods`. */
  segments: { name: string; cells: string[] }[]
  /** First slice of the HTML when parsing found nothing — for diagnosing layout drift. */
  rawSnippet?: string
}

/** A line whose name marks an elimination/contra, not an operating segment. */
function isContraSegment(name: string): boolean {
  return /less\s*:|inter[-\s]?segment|elimination|adjustment/i.test(name)
}

/**
 * Fetch + parse one section's product-segment table inside the page. Runs in the
 * browser so it reuses the logged-in session and DOM parsing (entities decoded).
 */
function fetchSegmentSection(
  page: Page,
  companyId: string,
  section: 'profit-loss' | 'quarters',
  consolidated: boolean,
): Promise<RawSegmentTable> {
  return page.evaluate(
    async ({ companyId, section, consolidated, segtype }) => {
      const qs = consolidated ? '?consolidated=true' : ''
      const url = `/api/segments/${companyId}/${section}/${segtype}/${qs}`
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

      // Screener rate-limits the segment API (HTTP 429) under rapid calls, so
      // retry a 429/503 a few times with growing backoff before giving up.
      let res: Response | null = null
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          res = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        } catch {
          return { ok: false, httpStatus: 0, paywalled: false, periods: [], segments: [] }
        }
        if (res.status !== 429 && res.status !== 503) break
        await sleep(1500 * (attempt + 1)) // 1.5s, 3s, 4.5s
      }
      if (!res || !res.ok) return { ok: false, httpStatus: res ? res.status : 0, paywalled: false, periods: [], segments: [] }

      const html = await res.text()
      const paywalled = /upgrade to premium/i.test(html)
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const table = doc.querySelector('table.data-table')
      if (!table) {
        return { ok: true, httpStatus: 200, paywalled, periods: [], segments: [], rawSnippet: html.slice(0, 1600) }
      }

      const periods = Array.from(table.querySelectorAll('thead th'))
        .map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
        .slice(1) // first header is the blank row-label column

      const salesGroup = table.querySelector('[data-segment-line="Sales"]')
      const segments: { name: string; cells: string[] }[] = []

      if (salesGroup) {
        // Primary layout: one outer <tr> with two cells — a names table in the
        // first, a values table in the second, row-aligned across the two.
        const outerRow = salesGroup.querySelector(':scope > tr')
        const outerCells = outerRow ? Array.from(outerRow.children) : []
        const nameRows = outerCells[0] ? Array.from(outerCells[0].querySelectorAll('tr')) : []
        const valueRows = outerCells[1] ? Array.from(outerCells[1].querySelectorAll('tr')) : []
        for (let i = 0; i < nameRows.length; i++) {
          const nameEl = nameRows[i].querySelector('td.text') || nameRows[i].querySelector('td')
          const name = (nameEl?.textContent || '').replace(/\s+/g, ' ').trim()
          if (!name || name.toLowerCase() === 'sales') continue
          const vr = valueRows[i]
          const cells = vr
            ? Array.from(vr.querySelectorAll('td')).map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
            : []
          segments.push({ name, cells })
        }

        // Fallback layout: flat rows (name cell + value cells in one <tr>).
        if (segments.length === 0 || segments.every((s) => s.cells.length === 0)) {
          const flat: { name: string; cells: string[] }[] = []
          for (const tr of Array.from(salesGroup.querySelectorAll('tr'))) {
            const nameEl = tr.querySelector('td.text')
            const name = (nameEl?.textContent || '').replace(/\s+/g, ' ').trim()
            if (!name || name.toLowerCase() === 'sales') continue
            const cells = Array.from(tr.querySelectorAll('td'))
              .filter((td) => !td.classList.contains('text'))
              .map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
            if (cells.length) flat.push({ name, cells })
          }
          if (flat.some((s) => s.cells.length)) {
            segments.length = 0
            segments.push(...flat)
          }
        }
      }

      const gotValues = segments.some((s) => s.cells.length > 0)
      const rawSnippet = !gotValues && !paywalled ? html.slice(0, 1600) : undefined
      return { ok: true, httpStatus: 200, paywalled, periods, segments, rawSnippet }
    },
    { companyId, section, consolidated, segtype: PRODUCT_SEGMENTS },
  )
}

function unavailable(reason: 'not-reported' | 'not-scraped' | 'parse-failed', note: string): SegmentMix {
  return { status: 'unavailable', reason, note }
}

function segmentId(name: string, index: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || `segment-${index + 1}`
}

/** Map a raw section table into a `SegmentMix`, plus a one-line log summary.
 * Exported for unit tests; the runtime reaches it via `fetchScreenerSegments`. */
export function buildSegmentMix(raw: RawSegmentTable, cadence: PeriodCadence): { mix: SegmentMix; log: string } {
  if (!raw.ok) return { mix: unavailable('not-scraped', `Segment API returned HTTP ${raw.httpStatus}.`), log: `http ${raw.httpStatus}` }
  if (raw.paywalled) {
    return { mix: unavailable('not-scraped', 'Segment figures require Screener Premium.'), log: 'paywalled (account not Premium?)' }
  }
  if (raw.segments.length === 0) {
    const extra = raw.rawSnippet ? ` — snippet: ${raw.rawSnippet.slice(0, 200).replace(/\s+/g, ' ')}` : ''
    return { mix: unavailable('not-reported', 'No product-segment split reported.'), log: `no segments${extra}` }
  }

  // Map each period column to a schema period id; non-period columns (TTM, etc.) → null.
  const periodIds = raw.periods.map((h) => parsePeriodHeader(h, cadence)?.id ?? null)

  const parsed = raw.segments
    .map((s) => ({ name: s.name, values: s.cells.map((c) => parseCell(c)) }))
    .filter((s) => s.name)

  const operating = parsed.filter((s) => !isContraSegment(s.name))
  if (operating.length === 0) return { mix: unavailable('not-reported', 'No operating segments reported.'), log: 'only contra lines' }

  // Per-period operating total (positive values only), for share denominators.
  const totals = raw.periods.map((_, i) =>
    operating.reduce((sum, s) => {
      const v = s.values[i]
      return sum + (typeof v === 'number' && v > 0 ? v : 0)
    }, 0),
  )

  const segments: RevenueSegment[] = operating
    .map((s, si) => {
      const values: SegmentRevenue[] = []
      for (let i = 0; i < raw.periods.length; i++) {
        const pid = periodIds[i]
        const v = s.values[i]
        const total = totals[i]
        if (!pid || typeof v !== 'number' || total <= 0) continue
        values.push({ periodId: pid, revenue: round(v, 2), sharePercent: round((v / total) * 100, 1) })
      }
      return { id: segmentId(s.name, si), name: s.name, values }
    })
    .filter((s) => s.values.length > 0)

  if (segments.length === 0) return { mix: unavailable('not-reported', 'No segment split for the reported periods.'), log: 'no aligned periods' }

  const latest = segments
    .map((s) => s.values[s.values.length - 1])
    .filter((v): v is SegmentRevenue => Boolean(v))
  const latestPid = latest.length ? latest[latest.length - 1].periodId : '?'
  return {
    mix: { status: 'available', segments },
    log: `✓ ${segments.length} segments (latest ${latestPid}: ${segments.map((s) => s.name).slice(0, 4).join(', ')}${segments.length > 4 ? '…' : ''})`,
  }
}

export interface ScreenerSegments {
  annual: SegmentMix
  quarterly: SegmentMix
  logLines: string[]
}

/**
 * Fetch both the annual (P&L) and quarterly product-segment mixes for a company.
 * `consolidated` should match the basis the statements were scraped at; if that
 * basis returns nothing, we retry the other basis once (some companies disclose
 * segments only on one).
 */
export async function fetchScreenerSegments(
  page: Page,
  companyId: string,
  consolidated: boolean,
): Promise<ScreenerSegments> {
  const logLines: string[] = []

  async function forSection(section: 'profit-loss' | 'quarters', cadence: PeriodCadence): Promise<SegmentMix> {
    let raw = await fetchSegmentSection(page, companyId, section, consolidated)
    let built = buildSegmentMix(raw, cadence)
    // Retry the other basis if the matched one had no data at all (not paywalled).
    if (built.mix.status !== 'available' && !raw.paywalled && raw.ok && raw.segments.length === 0) {
      const alt = await fetchSegmentSection(page, companyId, section, !consolidated)
      if (alt.ok && alt.segments.length > 0) {
        raw = alt
        built = buildSegmentMix(alt, cadence)
        if (built.mix.status === 'available') built.log += ` [${!consolidated ? 'consolidated' : 'standalone'} fallback]`
      }
    }
    logLines.push(`segment mix (${section === 'profit-loss' ? 'annual' : 'quarterly'}): ${built.log}`)
    return built.mix
  }

  const annual = await forSection('profit-loss', 'annual')
  await page.waitForTimeout(800) // space the two segment calls to stay under Screener's rate limit
  const quarterly = await forSection('quarters', 'quarterly')
  return { annual, quarterly, logLines }
}
