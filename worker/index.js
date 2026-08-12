/**
 * Cloudflare Worker for the Dhamma earnings dashboard.
 *
 * Two API routes plus the static site:
 *   GET  /api/financials?ticker=SYMBOL  → the company's scraped statements,
 *        read fresh from the repo (404 when that company hasn't been scraped
 *        yet — the dashboard turns that into an "Analyze" prompt).
 *   POST /api/analyze  { ticker } | { tickers: [...] }
 *        → dispatches the scrape workflow for one company or a batch (the peer
 *        "Run all" sends a batch, scraped in a single run). The GitHub token
 *        lives only in the Worker env, never the browser. Data lands back in the
 *        repo a few minutes later, and the dashboard's polling picks it up.
 *   everything else                     → the static SPA via the ASSETS binding.
 *
 * Secrets/vars (Cloudflare → Worker → Settings → Variables):
 *   GITHUB_TOKEN       fine-grained PAT for this repo: Actions read/write,
 *                      Contents read. Required for /api/analyze; also used to
 *                      read data fresh (no CDN cache) when present.
 *   GITHUB_REPO        "owner/repo" (default "techmuns/three-statement-model").
 *   GITHUB_BRANCH      branch to read/dispatch on (default "main").
 *   ANALYZE_WORKFLOW   workflow file name (default "refresh-scraped-data.yml").
 *   ANALYZE_PASSCODE   optional; when set, /api/analyze requires it (header
 *                      x-analyze-passcode or body.passcode) to prevent abuse.
 */

const DEFAULT_REPO = 'techmuns/three-statement-model'
const DEFAULT_BRANCH = 'main'
const DEFAULT_WORKFLOW = 'refresh-scraped-data.yml'
const TICKER_RE = /^[A-Z0-9&.\-]{1,20}$/
// Upper bound on a single batch (peer "Run all"), to cap run time and abuse.
const MAX_ANALYZE_TICKERS = 12
const GH_HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'dhamma-earnings-dashboard',
})

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const { pathname } = url

    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }))
    if (pathname === '/api/financials') return cors(await handleFinancials(url, env))
    if (pathname === '/api/analyze') return cors(await handleAnalyze(request, env))
    if (pathname === '/api/companies') return cors(await handleCompanies(env))

    // Static single-page app for everything else.
    return env.ASSETS.fetch(request)
  },
}

async function handleFinancials(url, env) {
  const ticker = (url.searchParams.get('ticker') || '').trim().toUpperCase()
  if (!TICKER_RE.test(ticker)) return json({ error: 'bad-ticker' }, 400)

  const repo = env.GITHUB_REPO || DEFAULT_REPO
  const branch = env.GITHUB_BRANCH || DEFAULT_BRANCH
  const path = `data/${ticker}.json`

  // Prefer the authenticated Contents API (no CDN cache — matters while polling
  // for a just-dispatched company). Fall back to the public raw host.
  let res
  if (env.GITHUB_TOKEN) {
    res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`, {
      headers: { ...GH_HEADERS(env.GITHUB_TOKEN), Accept: 'application/vnd.github.raw' },
    })
  } else {
    res = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/${path}`, {
      cf: { cacheTtl: 30, cacheEverything: true },
    })
  }

  if (res.status === 404) return json({ status: 'absent', ticker }, 404)
  if (!res.ok) return json({ error: 'upstream', status: res.status }, 502)

  let data
  try {
    data = await res.json()
  } catch {
    return json({ error: 'parse' }, 502)
  }
  return json({ status: 'ok', ticker, data })
}

/**
 * The symbols already scraped (a data/<SYMBOL>.json exists) — powers the
 * "already analyzed, open instantly" dropdown. Best-effort: any hiccup returns
 * an empty list and the dropdown simply falls back to search-as-you-type.
 */
async function handleCompanies(env) {
  const repo = env.GITHUB_REPO || DEFAULT_REPO
  const branch = env.GITHUB_BRANCH || DEFAULT_BRANCH
  const headers = env.GITHUB_TOKEN
    ? GH_HEADERS(env.GITHUB_TOKEN)
    : { Accept: 'application/vnd.github+json', 'User-Agent': 'dhamma-earnings-dashboard' }

  let res
  try {
    res = await fetch(`https://api.github.com/repos/${repo}/contents/data?ref=${branch}`, { headers })
  } catch {
    return json({ companies: [] })
  }
  if (!res.ok) return json({ companies: [] })

  const files = await res.json().catch(() => null)
  const companies = Array.isArray(files)
    ? files
        .filter((f) => f.type === 'file' && /\.json$/i.test(f.name))
        .map((f) => f.name.replace(/\.json$/i, '').toUpperCase())
        .sort()
    : []
  return json({ companies })
}

async function handleAnalyze(request, env) {
  if (request.method !== 'POST') return json({ error: 'method' }, 405)

  const body = await request.json().catch(() => ({}))
  // Accept one company ({ ticker }, optionally comma-separated) or a batch
  // ({ tickers: [...] }). The batch form is what "Run all peers" uses, so every
  // peer is scraped in a single run rather than one queued run each.
  const raw = Array.isArray(body.tickers) ? body.tickers : String(body.ticker || '').split(',')
  const tickers = [...new Set(raw.map((t) => String(t).trim().toUpperCase()).filter(Boolean))]
  if (tickers.length === 0) return json({ error: 'bad-ticker' }, 400)
  if (tickers.length > MAX_ANALYZE_TICKERS) return json({ error: 'too-many', max: MAX_ANALYZE_TICKERS }, 400)
  if (!tickers.every((t) => TICKER_RE.test(t))) return json({ error: 'bad-ticker' }, 400)

  // Only the token must be a real secret. Repo/branch fall back to the repo's
  // own defaults (and are also set in wrangler.jsonc), so a redeploy that drops
  // dashboard-set plain vars can never switch Analyze back off.
  if (!env.GITHUB_TOKEN) {
    return json(
      {
        error: 'not-configured',
        message: 'Analyze is not switched on yet — set the GITHUB_TOKEN secret on the Worker.',
      },
      503,
    )
  }

  if (env.ANALYZE_PASSCODE) {
    const provided = request.headers.get('x-analyze-passcode') || body.passcode
    if (provided !== env.ANALYZE_PASSCODE) return json({ error: 'unauthorized' }, 401)
  }

  const repo = env.GITHUB_REPO || DEFAULT_REPO
  const branch = env.GITHUB_BRANCH || DEFAULT_BRANCH
  const workflow = env.ANALYZE_WORKFLOW || DEFAULT_WORKFLOW
  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: 'POST',
      headers: { ...GH_HEADERS(env.GITHUB_TOKEN), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: branch, inputs: { ticker: tickers.join(',') } }),
    },
  )

  if (res.status === 204) return json({ status: 'dispatched', tickers })
  const detail = (await res.text().catch(() => '')).slice(0, 300)
  return json({ error: 'dispatch-failed', status: res.status, detail }, 502)
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function cors(res) {
  const headers = new Headers(res.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, x-analyze-passcode')
  return new Response(res.body, { status: res.status, headers })
}
