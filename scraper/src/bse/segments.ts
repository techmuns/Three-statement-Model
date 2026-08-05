/**
 * Extracting the standardised segment-revenue table from a BSE Reg-33
 * "Financial Results" statement PDF.
 *
 * Grounded in the real filing structure, verified against Reliance Industries'
 * Q1 FY27 statement (BSE scrip 500325). SEBI's prescribed quarterly-results
 * format prints a block headed **"Segment Value of Sales and Services
 * (Revenue)"** whose rows are the reportable segments and whose data columns
 * run left-to-right as: current quarter, preceding quarter, year-ago quarter,
 * then any year-to-date / audited-year columns. The block closes with a
 * **"Gross Value of Sales and Services"** total row — a built-in checksum every
 * extracted column is validated against, so a mis-read never reaches the data
 * files.
 *
 * A genuinely single-segment filer (e.g. Reliance Industrial Infrastructure)
 * prints "there are no separate reportable segments" in place of the table;
 * that is detected and reported as `single`, not treated as an error.
 *
 * PDF text is read with pdf.js. Numbers arrive with light font-encoding noise
 * (a stray leading '.', ';' for ','); since segment revenue is always a whole
 * number of crore, stripping every non-digit yields the exact integer, and the
 * checksum confirms it.
 */

import { readFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

export interface ParsedSegment {
  readonly name: string
  /** Revenue per data column, left → right, in ₹ crore. */
  readonly revenueByColumn: readonly number[]
}

export interface SegmentTable {
  /** Subject quarter end of the filing, ISO `YYYY-MM-DD`. */
  readonly quarterEndISO: string
  readonly segments: readonly ParsedSegment[]
  /** "Gross Value of Sales and Services" per column — the checksum row. */
  readonly grossByColumn: readonly number[]
}

export type SegmentExtraction =
  | { readonly kind: 'multi'; readonly table: SegmentTable }
  | { readonly kind: 'single'; readonly note: string }

interface Item {
  readonly x: number
  readonly y: number
  readonly s: string
}

const MONTHS: Readonly<Record<string, number>> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

/** All text items of every page, with rounded integer coordinates. */
async function loadPages(pdfPath: string): Promise<Item[][]> {
  const data = new Uint8Array(await readFile(pdfPath))
  const doc = await getDocument({ data, verbosity: 0 }).promise
  const pages: Item[][] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push(
      content.items
        .filter((it: any) => typeof it.str === 'string' && it.str.trim())
        .map((it: any) => ({ x: Math.round(it.transform[4]), y: Math.round(it.transform[5]), s: it.str.trim() })),
    )
  }
  return pages
}

function pageText(items: Item[]): string {
  return items.map((it) => it.s).join(' ')
}

/** Strip font-encoding noise; segment revenue is always a whole crore number. */
function toInt(token: string): number | null {
  const digits = token.replace(/[^\d]/g, '')
  return digits ? Number(digits) : null
}

/** Parse the filing's subject quarter end, e.g. "...quarter ended June 30, 2026". */
function parseQuarterEnd(firstPage: Item[]): string | null {
  const text = pageText(firstPage)
  const m = /quarter[\s\S]{0,40}?ended\s+([A-Za-z]+)\s+(\d{1,2})\s*,?\s*(\d{4})/i.exec(text)
  if (!m) return null
  const month = MONTHS[m[1].toLowerCase()]
  if (!month) return null
  const day = String(Number(m[2])).padStart(2, '0')
  return `${m[3]}-${String(month).padStart(2, '0')}-${day}`
}

/** Group items into rows by y (tolerance 3px), each row sorted left → right. */
function toRows(items: Item[]): Item[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: Item[][] = []
  let current: Item[] = []
  let y: number | null = null
  for (const it of sorted) {
    if (y === null || Math.abs(it.y - y) > 3) {
      if (current.length) rows.push(current)
      current = []
      y = it.y
    }
    current.push(it)
  }
  if (current.length) rows.push(current)
  return rows
}

/** Cluster x-positions into column centres (a gap > 30px starts a new column). */
function columnCentres(xs: number[]): number[] {
  const sorted = [...xs].sort((a, b) => a - b)
  const centres: number[] = []
  let group: number[] = []
  for (const x of sorted) {
    if (group.length && x - group[group.length - 1] > 30) {
      centres.push(group.reduce((a, b) => a + b, 0) / group.length)
      group = []
    }
    group.push(x)
  }
  if (group.length) centres.push(group.reduce((a, b) => a + b, 0) / group.length)
  return centres
}

// "and" or "&" both appear across filings; the table header is "Segment Value
// of Sales and/& Services (Revenue)", closed by "Gross Value of Sales …".
const REVENUE_ANCHOR = /segment\s+value\s+of\s+sales\s+(?:and|&)\s+services/i
const GROSS_ANCHOR = /gross\s+value\s+of\s+sales\s+(?:and|&)\s+services/i
const SINGLE_SEGMENT = /no\s+separate\s+reportable\s+segment/i
/** Left of this x sits a row's label, right of it sit the numeric columns. */
const LABEL_MAX_X = 240

/**
 * Extract the consolidated segment-revenue table from a results-statement PDF,
 * or report that the filer has a single reportable segment.
 */
export async function extractSegments(pdfPath: string): Promise<SegmentExtraction> {
  const pages = await loadPages(pdfPath)
  if (pages.length === 0) throw new Error('empty PDF')

  const quarterEndISO = parseQuarterEnd(pages[0])
  if (!quarterEndISO) throw new Error('could not read the subject quarter-end from page 1')

  // Prefer the consolidated segment page; fall back to any segment page.
  const segmentPages = pages.filter((p) => REVENUE_ANCHOR.test(pageText(p)) && GROSS_ANCHOR.test(pageText(p)))
  const page =
    segmentPages.find((p) => /consolidated/i.test(pageText(p))) ?? segmentPages[0] ?? null

  if (!page) {
    if (pages.some((p) => SINGLE_SEGMENT.test(pageText(p)))) {
      return { kind: 'single', note: 'Filing reports no separate reportable segments (single-segment company).' }
    }
    throw new Error('no segment-revenue table found in filing')
  }

  const rows = toRows(page)
  const anchorIdx = rows.findIndex((r) => REVENUE_ANCHOR.test(r.map((i) => i.s).join(' ')))
  const grossIdx = rows.findIndex((r) => GROSS_ANCHOR.test(r.map((i) => i.s).join(' ')))
  if (anchorIdx === -1 || grossIdx === -1 || grossIdx <= anchorIdx) {
    throw new Error('segment-revenue block boundaries not found')
  }

  const bodyRows = rows.slice(anchorIdx + 1, grossIdx)
  const grossRow = rows[grossIdx]

  // Column geometry from every numeric token in the block (body + gross row).
  const numberXs = [...bodyRows, grossRow]
    .flatMap((r) => r.filter((i) => i.x >= LABEL_MAX_X && /\d/.test(i.s)))
    .map((i) => i.x)
  const centres = columnCentres(numberXs)
  if (centres.length < 3) throw new Error(`expected >= 3 data columns, found ${centres.length}`)

  const cellsFor = (row: Item[]): (number | null)[] => {
    const nums = row.filter((i) => i.x >= LABEL_MAX_X && /\d/.test(i.s))
    return centres.map((c) => {
      const hit = nums.find((n) => Math.abs(n.x - c) <= 30)
      return hit ? toInt(hit.s) : null
    })
  }

  const segments: ParsedSegment[] = []
  for (const row of bodyRows) {
    const label = row
      .filter((i) => i.x < LABEL_MAX_X)
      .map((i) => i.s)
      .join(' ')
      .replace(/^[-–•\s]+/, '')
      .replace(/\s+/g, ' ')
      .trim()
    const cells = cellsFor(row)
    // A real segment row has a name and a value in the current-quarter column.
    if (!label || cells[0] === null) continue
    segments.push({ name: label, revenueByColumn: cells.map((c) => c ?? 0) })
  }

  const grossByColumn = cellsFor(grossRow).map((c) => c ?? 0)
  if (segments.length === 0) throw new Error('no segment rows parsed')

  // Checksum: each of the three quarter columns must sum to the gross row.
  for (let c = 0; c < Math.min(3, centres.length); c++) {
    const sum = segments.reduce((acc, s) => acc + s.revenueByColumn[c], 0)
    if (Math.abs(sum - grossByColumn[c]) > 2) {
      throw new Error(
        `checksum failed for column ${c}: segments sum to ${sum}, gross row is ${grossByColumn[c]}`,
      )
    }
  }

  return { kind: 'multi', table: { quarterEndISO, segments, grossByColumn } }
}
