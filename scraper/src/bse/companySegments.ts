/**
 * Best-effort quarterly segment mix for one company, fully automatic.
 *
 * Ties the pieces together: discover the latest BSE results filings (via
 * Scrape.do), download each PDF, extract its checksum-validated segment table,
 * and fold them into the frontend's `SegmentMix` for the company's own quarterly
 * periods. Everything is defensive — a company with no filings, a single
 * segment, or an unparseable PDF resolves to a truthful state (or `null`, so the
 * caller keeps "not reported"), never a fabricated split.
 */

import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { SegmentMix } from '../../../src/types/financials'
import { downloadFiling } from './download'
import { buildSegmentMix } from './normalize'
import { extractSegments, type SegmentTable } from './segments'

/**
 * Resolve `quarterly.segmentMix` for a company from its BSE filings, or `null`
 * when nothing usable was found (caller then keeps the existing unavailable
 * state). A genuine single-segment filer returns an `unavailable/not-reported`
 * mix — that is the honest answer, not a failure.
 */
export async function fetchCompanySegmentMix(
  filingUrls: readonly string[],
  quarterlyPeriodIds: readonly string[],
): Promise<SegmentMix | null> {
  if (quarterlyPeriodIds.length === 0 || filingUrls.length === 0) return null

  const tmp = await mkdtemp(path.join(tmpdir(), 'bse-seg-'))
  const tables: SegmentTable[] = []
  for (const [i, url] of filingUrls.entries()) {
    const dest = path.join(tmp, `filing-${i}.pdf`)
    try {
      await downloadFiling(url, dest)
      const extraction = await extractSegments(dest)
      if (extraction.kind === 'single') {
        return { status: 'unavailable', reason: 'not-reported', note: extraction.note }
      }
      tables.push(extraction.table)
      console.log(
        `      segment PDF ${i}: parsed ${extraction.table.segments.length} segments (${extraction.table.quarterEndISO})`,
      )
    } catch (err) {
      // Skip an unreadable or mismatched filing (e.g. an annual report, not the
      // quarterly results format) and try the next candidate.
      console.log(`      segment PDF ${i}: skipped — ${(err as Error).message}`)
    }
  }
  if (tables.length === 0) return null

  const built = buildSegmentMix(tables, [...quarterlyPeriodIds])
  const latestId = quarterlyPeriodIds[quarterlyPeriodIds.length - 1]
  // Only claim a mix when the latest quarter (the one the dashboard shows) is
  // covered; otherwise stay honest and let the caller keep "not reported".
  if (!built.coveredPeriodIds.includes(latestId)) {
    console.log(`      segment mix: parsed ${tables.length} filing(s) but latest quarter not covered`)
    return null
  }

  return { status: 'available', segments: built.segments }
}
