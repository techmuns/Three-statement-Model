/**
 * Writing one `CompanyFinancials` to `data/<SYMBOL>.json` at the repo root.
 *
 * The output directory is resolved from this file's location, not the working
 * directory, so `npm run scrape` writes to the repo-root `data/` regardless of
 * where it is invoked from.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CompanyFinancials } from '../../src/types/financials'
import type { PeerGroup } from '../../src/types/peers'

const scraperDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.resolve(scraperDir, '..', 'data')
const peerGroupsDir = path.resolve(dataDir, 'peer-groups')

/** Write the company file and return its path, relative to the working dir. */
export async function writeCompanyFile(
  symbol: string,
  financials: CompanyFinancials,
): Promise<string> {
  await mkdir(dataDir, { recursive: true })
  const file = path.join(dataDir, `${symbol}.json`)
  await writeFile(file, `${JSON.stringify(financials, null, 2)}\n`, 'utf8')
  return path.relative(process.cwd(), file)
}

/**
 * The `source.fetchedAt` ISO timestamp of a company's existing data file, or
 * `null` when it has never been scraped (no file) or the file is unreadable /
 * malformed. Used by the rotation selector to rank companies by staleness — a
 * `null` result is treated as maximally stale, so both never-scraped and broken
 * files get re-scraped first.
 */
export async function readFetchedAt(symbol: string): Promise<string | null> {
  try {
    const raw = await readFile(path.join(dataDir, `${symbol}.json`), 'utf8')
    const parsed = JSON.parse(raw) as { source?: { fetchedAt?: unknown } }
    return typeof parsed.source?.fetchedAt === 'string' ? parsed.source.fetchedAt : null
  } catch {
    return null
  }
}

/** Write one peer group to data/peer-groups/<id>.json; returns its path. */
export async function writePeerGroupFile(group: PeerGroup): Promise<string> {
  await mkdir(peerGroupsDir, { recursive: true })
  const file = path.join(peerGroupsDir, `${group.id}.json`)
  await writeFile(file, `${JSON.stringify(group, null, 2)}\n`, 'utf8')
  return path.relative(process.cwd(), file)
}
