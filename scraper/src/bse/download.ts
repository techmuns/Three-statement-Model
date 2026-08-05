/**
 * Fetching a BSE filing PDF to a local path.
 *
 * BSE's JSON API (`api.bseindia.com`) sits behind an Akamai bot-manager that
 * blocks datacenter/non-browser clients, but the static filing host
 * (`www.bseindia.com/xml-data/corpfiling/...`) serves the attachment PDFs
 * directly. We fetch those with `curl` — it is present in CI and in the dev
 * sandbox, and (unlike a bare `fetch`) it transparently honours the sandbox's
 * `HTTPS_PROXY`, so the same code path works in both places.
 *
 * A browser User-Agent and a bseindia.com Referer are sent because the static
 * host rejects obviously-scripted requests; a fixed inter-request delay in the
 * caller keeps the crawl polite, matching the Screener scraper's manners.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/** Download `url` to `destPath`. Throws if the response is not a PDF. */
export async function downloadFiling(url: string, destPath: string): Promise<void> {
  const { stdout } = await run(
    'curl',
    [
      '--silent',
      '--show-error',
      '--location',
      '--max-time',
      '120',
      '--user-agent',
      BROWSER_UA,
      '--header',
      'Referer: https://www.bseindia.com/',
      '--output',
      destPath,
      '--write-out',
      '%{http_code} %{content_type}',
      url,
    ],
    { maxBuffer: 1024 * 1024 },
  )
  const [status, contentType = ''] = stdout.trim().split(/\s+/)
  if (status !== '200') {
    throw new Error(`BSE returned HTTP ${status} for ${url}`)
  }
  if (!contentType.includes('pdf')) {
    throw new Error(`BSE served ${contentType || 'unknown content'} (not a PDF) for ${url}`)
  }
}
