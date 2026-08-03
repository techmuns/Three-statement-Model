/**
 * Writing one `CompanyFinancials` to `data/<SYMBOL>.json` at the repo root.
 *
 * The output directory is resolved from this file's location, not the working
 * directory, so `npm run scrape` writes to the repo-root `data/` regardless of
 * where it is invoked from.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CompanyFinancials } from '../../src/types/financials'

const scraperDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.resolve(scraperDir, '..', 'data')

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
