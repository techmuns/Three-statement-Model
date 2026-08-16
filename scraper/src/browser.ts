/**
 * Browser lifecycle and the Screener login.
 *
 * One browser, one logged-in context, reused across every company — we log in
 * once, not per company. Credentials are typed into the form via Playwright and
 * never logged; a failed login throws without echoing them.
 *
 * ── Fragile page-structure assumptions ──
 *   • Login lives at https://www.screener.in/login/ with a username (email)
 *     field, a password field, and a submit button.
 *   • A successful login navigates away from the `/login/` path.
 */

import { chromium, type Browser, type BrowserContext } from 'playwright'
import type { ScreenerCredentials } from './env'

const LOGIN_URL = 'https://www.screener.in/login/'
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

export function launchBrowser(): Promise<Browser> {
  // Normal machines resolve the Playwright-managed Chromium automatically. An
  // environment that ships its own browser (CI, a container) can point at it
  // with PLAYWRIGHT_CHROMIUM_PATH instead of downloading one.
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH?.trim() || undefined
  return chromium.launch({ headless: true, executablePath })
}

/**
 * Create a context and log it in. The returned context carries the session
 * cookie, so every subsequent page load is authenticated.
 */
export async function createLoggedInContext(
  browser: Browser,
  credentials: ScreenerCredentials,
): Promise<BrowserContext> {
  const context = await browser.newContext({ userAgent: USER_AGENT })

  // Retry the login a few times: Screener's /login/ page occasionally times out
  // or hiccups, and a single failure otherwise sinks the whole run (and a user's
  // on-demand Analyze). A genuine bad-credential failure simply exhausts the
  // retries and throws — credentials are never printed either way.
  const attempts = 3
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const page = await context.newPage()
    try {
      await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await page.fill('input[name="username"], #id_username', credentials.email)
      await page.fill('input[name="password"], #id_password', credentials.password)
      await page.click('button[type="submit"], input[type="submit"]')

      // Screener redirects off /login/ on success. Give it a moment, then check.
      await page
        .waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 })
        .catch(() => undefined)

      if (page.url().includes('/login')) {
        throw new Error(
          'Screener login failed — check SCREENER_EMAIL / SCREENER_PASSWORD ' +
            '(their values are never printed).',
        )
      }
      await page.close()
      return context
    } catch (error) {
      lastError = error as Error
      await page.close().catch(() => undefined)
      console.error(`Login attempt ${attempt}/${attempts} failed: ${(error as Error).message}`)
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 3_000))
    }
  }

  await context.close().catch(() => undefined)
  throw lastError ?? new Error('Screener login failed after retries')
}
