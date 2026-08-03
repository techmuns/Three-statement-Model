/**
 * Credentials, read from the environment — never hardcoded, never logged.
 *
 * Values come from `SCREENER_EMAIL` / `SCREENER_PASSWORD`, loaded from
 * `scraper/.env` (gitignored) if present, or from the ambient environment (how
 * a future CI phase will supply them). This module reads them and hands them to
 * the login flow; nothing here or downstream prints or persists them.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadDotenv } from 'dotenv'

const scraperDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Load scraper/.env if it exists. `override: false` means a value already set
// in the real environment (e.g. CI secrets) wins over the file.
loadDotenv({ path: path.join(scraperDir, '.env'), override: false })

export interface ScreenerCredentials {
  readonly email: string
  readonly password: string
}

/**
 * Read and validate the Screener credentials.
 *
 * Throws a clear error naming the missing variable(s) — but never their values —
 * so a misconfiguration fails loudly at startup rather than as an opaque login
 * failure later.
 */
export function readCredentials(): ScreenerCredentials {
  const email = process.env.SCREENER_EMAIL?.trim()
  const password = process.env.SCREENER_PASSWORD

  const missing: string[] = []
  if (!email) missing.push('SCREENER_EMAIL')
  if (!password) missing.push('SCREENER_PASSWORD')
  if (missing.length > 0) {
    throw new Error(
      `Missing credential(s): ${missing.join(', ')}. Set them in scraper/.env ` +
        `(copy scraper/.env.example) or export them into the environment. ` +
        `Their values are never printed or written to disk.`,
    )
  }

  return { email: email as string, password: password as string }
}
