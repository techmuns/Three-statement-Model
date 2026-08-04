# Vittara

Multi-company financial analytics dashboard for Indian listed companies.

Vittara presents the three financial statements — profit & loss, balance sheet
and cash flow — plus a KPI overview and peer comparison, for five large Indian
companies (Reliance, TCS, HDFC Bank, Infosys, Hindustan Unilever). Pick a
company from the switcher, toggle between the last five quarters and the last
five financial years, and move across the **Financials** and **KPI Overview**
tabs. Every widget renders real numbers where they have been scraped and clearly
labelled placeholder numbers otherwise — the data is never faked as real.

The app is a static single-page React site. There is no backend at request time:
financial data is scraped ahead of time into JSON files that Vite inlines at
build, and Cloudflare serves the built assets from the edge.

---

## How data flows

```
Screener.in ──(Playwright scraper)──▶ data/<SYMBOL>.json ──(import.meta.glob at build)──▶ dashboard
     │                                        │
 login + read                          validated at load;
 statement tables                      malformed → dropped
                                              │
                                    missing company → authored mock
```

1. **Scrape.** `scraper/` logs into Screener.in with Playwright and reads each
   company's statement tables and peer table, writing one
   `data/<SYMBOL>.json` per company (plus `data/peer-groups/*.json`).
2. **Load at build.** `src/data/scrapedFinancials.ts` inlines whatever exists in
   `data/*.json` via `import.meta.glob`. Each file self-identifies by its
   `companyId`. Files that fail runtime validation
   (`src/data/validateFinancials.ts`) are dropped with a warning.
3. **Prefer real, fall back to mock — per company.** The data accessors
   (`getCompanyFinancials`, `getCompanyDataSource` in `src/mocks/financials.ts`)
   return the scraped record when one loaded and validated for that company, and
   the authored mock otherwise. So a company with a good scrape shows live data
   while the rest stay on mock, independently.
4. **Say which it is.** The header badge reads **“Live · updated &lt;date&gt;”**
   for a company backed by real data and **“Mock data”** when it fell back, and
   each statement's footnote names its source (`source: screener, updated …`) or
   admits it is placeholder. `data/` is empty in a fresh clone, so with no scrape
   the whole app is honestly all-mock until the scheduled job (below) populates
   it.

`data/*.json` are generated artifacts, not hand-authored — `data/` tracks only
`.gitkeep`, and the scheduled GitHub Action commits the refreshed files.

---

## Commands

```bash
npm install          # once (installs the app; scraper deps install separately)

npm run dev          # local dev server (Vite, http://localhost:5173)
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build locally
npm run typecheck    # types only, no build
```

### Running the scraper locally

The scraper is a separate workspace under `scraper/` with its own dependencies.
It needs Screener.in credentials, which are read **only** from the environment —
never hardcoded, never logged.

```bash
cd scraper
npm install
npx playwright install --with-deps chromium   # once, to fetch the browser

export SCREENER_EMAIL="you@example.com"
export SCREENER_PASSWORD="…"

# from the repo root:
cd ..
npm run scrape -- RELIANCE      # one company by Screener symbol
npm run scrape:all              # all five companies + peer groups
```

Output lands in `data/` at the repo root. The scraper writes each company's file
as it succeeds and exits non-zero only to signal that *some* company failed — so
a single company's failure never discards the others' output. Rebuild
(`npm run build`) to pick up refreshed files.

### Deploying to Cloudflare Workers

`wrangler.jsonc` is configured for a static-assets-only Worker: Cloudflare serves
`dist/` from the edge and no Worker script runs.

`dist/` is gitignored, so it never exists in a fresh clone. `wrangler.jsonc`
therefore declares a `build.command` hook (`npm run build`) that wrangler runs
*before* every `deploy`/`dev`. This is what lets the Cloudflare git integration
(which only runs `npx wrangler deploy` on a fresh clone) build the app first —
without it, `wrangler deploy` aborts because `assets.directory` (`./dist`) does
not exist, and the deploy serves a blank page.

```bash
npx wrangler login          # once, per machine
npm run cf:deploy           # build + wrangler deploy (wrangler also builds via the hook)
npm run cf:preview          # build + wrangler dev (Workers runtime, locally)
npx wrangler deploy --dry-run   # validate config without deploying
```

`not_found_handling: "single-page-application"` means unknown paths return
`index.html`, so client-side routing will work when it is added.

---

## Refreshing data on a schedule (GitHub Actions)

`.github/workflows/refresh-scraped-data.yml` runs the scraper and commits the
refreshed `data/` back to `main`. **It does not deploy** — Cloudflare's own git
integration redeploys when `main` changes.

- **Schedule:** Mon/Wed/Fri at 21:00 UTC (≈ 02:30 IST, after the day's Indian
  filings, at a quiet hour). Statements only change when companies report, so a
  few times a week is plenty.
- **Manual run:** `workflow_dispatch` — trigger it on demand from the repo's
  **Actions → Refresh scraped data → Run workflow**.
- **Credentials:** the workflow reads `SCREENER_EMAIL` and `SCREENER_PASSWORD`
  from **repository secrets** (Settings → Secrets and variables → Actions). They
  are never printed.
- **Partial failure:** if one company fails, the others are still committed; the
  run is then marked failed so GitHub notifies you that Screener's page
  structure may have drifted or a login broke.
- **Branch protection:** the job pushes directly to `main`. If `main` is
  protected against the `github-actions` bot, the push is rejected and the run
  fails with a message explaining the fix (allow the bot to bypass protection,
  or switch the workflow to open a PR).

---

## Naming conventions

Keep future work consistent with these:

| Thing | Convention | Example |
|---|---|---|
| Component file | `PascalCase.tsx`, one main component per file, named export | `WidgetCard.tsx` |
| Non-component module | `camelCase.ts` | `useOnClickOutside.ts`, `provenance.ts` |
| Directory | lowercase, plural for collections | `components/widgets/` |
| Route-level screen | `<Name>View.tsx` in `views/<area>/` | `FinancialsView.tsx` |
| Reusable card | `Widget*` prefix | `WidgetSkeleton`, `WidgetEmptyState` |
| Props interface | `<Component>Props`, exported | `WidgetCardProps` |
| Id union type | `<Domain>Id` | `FinancialsTabId`, `PeriodViewId` |
| Constant | `SCREAMING_SNAKE_CASE` | `PRIMARY_TABS`, `MOCK_COMPANIES` |
| Change handler prop | `on<Thing>Change` / `onSelect` | `onPeriodChange` |
| Import path | `@/` alias from `src/`, never `../../` | `@/components/widgets/WidgetCard` |

`App.tsx` is the only stateful component. Views and components are presentational
and take state plus callbacks as props — so moving state to a router or a store
later touches one file. Views read data only through the accessor functions in
`src/mocks/` (`getCompanyFinancials`, `getCompanyKpis`, `getPeerComparison`,
`getCompanyDataSource`), never from a data file directly — that indirection is
where real-vs-mock fallback lives.

---

## Folder structure

```
.
├── index.html                  Vite entry document
├── vite.config.ts              Vite + React + Tailwind v4 plugin, `@/` alias
├── wrangler.jsonc              Cloudflare Workers static-assets config
├── tsconfig*.json              project references (app / node)
├── .github/workflows/
│   └── refresh-scraped-data.yml  scheduled + manual scrape → commit to main
├── data/                       ★ SCRAPER OUTPUT (generated; only .gitkeep tracked)
│   ├── <SYMBOL>.json           one company's financials
│   └── peer-groups/<id>.json   one sector cohort's peer snapshot
├── scraper/                    ★ standalone Playwright scraper (own package.json)
│   └── src/
│       ├── cli.ts              entry: `scrape <SYMBOL>` / `scrape --all`
│       ├── browser.ts          launch + one shared logged-in context
│       ├── env.ts              reads SCREENER_EMAIL / SCREENER_PASSWORD
│       ├── companies.ts        the five companies + symbol lookup
│       ├── scrape.ts           per-company orchestration (graceful failure)
│       ├── extract.ts          reads Screener DOM sections into raw tables
│       ├── normalize.ts        raw tables → CompanyFinancials (schema-shaped)
│       ├── numbers.ts          Screener number/percent parsing
│       ├── periods.ts          Screener column headers → PeriodRef
│       ├── peers.ts            the #peers table → peer KPI snapshots
│       ├── peerGroups.ts       assembles a PeerGroup per sector
│       └── output.ts           writes data/*.json and data/peer-groups/*.json
└── src/
    ├── main.tsx                React root
    ├── App.tsx                 all dashboard state lives here
    ├── styles/index.css        Tailwind import, base layer, shimmer keyframes
    ├── theme/
    │   ├── theme.css           ★ CANONICAL DESIGN TOKENS
    │   └── tokens.ts           typed `var(--…)` accessors for JS/SVG consumers
    ├── config/
    │   ├── app.ts              app name, tagline, data-stage label
    │   ├── navigation.ts       tab / sub-tab / period definitions and defaults
    │   └── kpis.ts             the standard KPI definitions (label, unit, formula)
    ├── types/                  ★ THE DATA SCHEMA (the scraper's contract)
    │   ├── common.ts           units, Reported<T>, Availability<T>, DataSource
    │   ├── period.ts           PeriodRef, cadence, Indian FY conventions
    │   ├── financials.ts       P&L / balance sheet / cash flow / segments
    │   ├── kpi.ts              KPI definitions, values, peer stats
    │   └── peers.ts            peer groups and comparison rows
    ├── data/                   ★ real scraped data, loaded + validated at build
    │   ├── scrapedFinancials.ts  import.meta.glob('/data/*.json'), by companyId
    │   └── validateFinancials.ts runtime shape check; bad file → mock fallback
    ├── lib/
    │   ├── cn.ts               conditional class-name join
    │   ├── format.ts           en-IN number formatting; null → "—"
    │   ├── kpiFormat.ts        KPI value formatting by unit
    │   ├── provenance.ts       source-aware badge/footnote strings (live vs mock)
    │   ├── statementLabels.ts  layout-aware P&L row labels (standard / banking)
    │   └── statements.ts       period toggle → statement set selector
    ├── hooks/useOnClickOutside.ts
    ├── mocks/                  authored fallback data + the data accessors
    │   ├── companies.ts        5 companies + search helper
    │   ├── periods.ts          the 5 quarters and 5 years everything keys to
    │   ├── financials.ts       authored inputs → derived statements; ★ accessors
    │   ├── peers.ts            4 sector cohorts with carried peer KPIs
    │   └── kpis.ts             KPIs derived from the statements + peer stats
    ├── components/
    │   ├── layout/
    │   │   ├── AppShell.tsx        skip link, page wash, main, footer
    │   │   ├── AppHeader.tsx       sticky header: wordmark, badge, switcher, tabs
    │   │   ├── DataSourceBadge.tsx live / mock badge for the selected company
    │   │   ├── Wordmark.tsx        logo glyph + gradient wordmark
    │   │   └── PageToolbar.tsx     view title + control strip
    │   ├── nav/
    │   │   ├── Tabs.tsx            ARIA tabs (primary + sub variants), TabPanel
    │   │   └── SegmentedControl.tsx single-choice control on native radios
    │   ├── company/
    │   │   ├── CompanySwitcher.tsx searchable ARIA combobox
    │   │   └── CompanyAvatar.tsx   monogram stand-in for a logo
    │   ├── charts/
    │   │   ├── RevenueMarginChart.tsx      revenue columns + margin line
    │   │   ├── SegmentMixChart.tsx         stacked segment mix + legend
    │   │   ├── BalanceSheetCompositionChart.tsx  funding mix, stacked
    │   │   ├── CashFlowActivityChart.tsx   CFO / CFI / CFF by period
    │   │   ├── KpiSparkline.tsx            per-KPI trend line
    │   │   └── ChartTooltip.tsx            shared tooltip surface
    │   └── widgets/
    │       ├── WidgetCard.tsx      ★ the one card shell
    │       ├── WidgetGrid.tsx      responsive auto-fill grid
    │       ├── WidgetSkeleton.tsx  shimmer loading state (genuine loads)
    │       ├── WidgetEmptyState.tsx honest empty / unavailable state
    │       ├── AnnualOnlyNotice.tsx  “reported annually only” banner (BS/CF)
    │       ├── StatTile.tsx        StatTile + StatList
    │       ├── KpiStatTile.tsx     a KPI value + peer context + sparkline
    │       ├── DeltaBadge.tsx      period-on-period change pill
    │       ├── PeerComparisonTable.tsx  tracked vs carried peer rows
    │       └── StatementTable.tsx  line items down, periods across
    └── views/
        ├── financials/
        │   ├── FinancialsView.tsx   period toggle + P&L / BS / CF sub-tabs
        │   ├── ProfitLossPanel.tsx  P&L tab
        │   ├── BalanceSheetPanel.tsx balance-sheet tab
        │   └── CashFlowPanel.tsx    cash-flow tab
        └── kpi/
            ├── KpiOverviewView.tsx  the KPI Overview tab
            └── KpiOverviewPanel.tsx KPI groups + peer comparison
```

---

## Design tokens

`src/theme/theme.css` is the single source of truth for colour, typography,
spacing, radius, shadow and gradients. Two rules:

1. **Never hardcode a hex value in a component.** Add a token instead.
2. **Consume tokens as Tailwind classes in TSX** (`bg-surface-card`,
   `text-ink-muted`, `rounded-card`, `text-title`). Use `src/theme/tokens.ts`
   only where a class name will not work — charts and inline styles. It exports
   `var(--…)` references rather than copies of the values, so nothing can drift.

The block is declared `@theme static` deliberately: without `static`, Tailwind
prunes any custom property no utility class references, which silently breaks the
tokens read through `var()` from TypeScript.

### The series palette

`--color-series-1 … 8` is the categorical palette for charts. Assign slots **in
order and never cycle** — the ordering is what makes the ramp colour-blind-safe.
Validated against the card surface `#ffffff`: worst adjacent CVD ΔE 9.1 (target
≥ 8), worst adjacent normal-vision ΔE 19.6 (floor ≥ 15). Slots 3, 4 and 5 sit
below 3:1 contrast on white, so whenever they carry meaning they need a direct
label or a table view alongside — colour alone is not enough. Past slot 8, fold
into an "Other" bucket or facet into small multiples rather than inventing a
ninth hue.

Status colours (`--color-status-*`) are reserved for good/warning/critical state
and must never be reused as a series colour.

---

## Data schema

`src/types/` is the contract the Screener.in scraper satisfies. Three things
about the source shape it:

**Money is ₹ crore, everywhere.** `Crore`, `Percent`, `Rupees` and `Ratio` are
documented aliases so a field's unit is readable at the call site. `Percent` is
the number a reader sees: `17.42` means 17.42%.

**"Not available" is modelled, not faked.** Two levels:

- `Reported<T> = T | null` for a single blank cell. `null` means the source did
  not report the line — never zero. A bank has no CWIP row; that is `null`, and
  a chart must skip the point rather than plot a zero.
- `Availability<T>` for a whole statement, discriminated on `status`, carrying
  an `UnavailableReason` (`not-reported` / `not-scraped` / `restated` /
  `parse-failed`) and a human-readable note for an empty-state card. A consumer
  cannot reach the data without handling the missing case first.

Quarterly balance sheets and cash flow statements are `unavailable` with reason
`not-reported` for all five companies, which is the real situation: SEBI LODR
requires them half-yearly at the earliest and Screener publishes annual columns
only. Quarterly segment disclosure is `not-scraped` — filed with the exchange,
absent from the Screener company page. Both surface as an honest empty-state card
rather than a blank.

**Banks use a different P&L layout.** `CompanyFinancials.statementLayout` is
`'standard'` or `'banking'`. The field names are identical either way; what
changes is the identity:

| | standard | banking |
|---|---|---|
| `sales` | Sales | Revenue (interest earned) |
| `interest` | finance cost | interest **expended** |
| `operatingProfit` | `sales − expenses` | `sales − expenses − interest` |
| `opmPercent` | OPM % | Financing Margin % |
| `profitBeforeTax` | `OP + otherIncome − interest − depreciation` | `OP + otherIncome − depreciation` |

### Mock data (the fallback)

`mocks/financials.ts` authors *inputs* and derives everything implied by them,
so the accounting identities hold by construction: the balance sheet balances,
CFO is the sum of its parts, segment revenues sum exactly to sales, and the four
FY26 quarters sum to the FY26 annual column. Scale and ratios are modelled on
the real companies so derived KPIs land in the right neighbourhood — but every
figure is invented and none should be quoted as fact. This is what a company
falls back to when no valid scraped file exists for it.

`mocks/kpis.ts` computes the KPI set from those statements rather than authoring
it, so a KPI cannot contradict the statement it summarises — and it does the same
whether the statements came from a scrape or the mock, so KPIs are correct on
real data too. Peer comparison remains carried from `mocks/peers.ts`.

## Charts

Recharts, styled entirely from the `--color-series-*` tokens via
`seriesColor()`, so a chart cannot introduce a colour the design system has not
validated. Two rules the charts here follow, both worth keeping:

**No dual axes.** "Revenue and OPM%" is the classic dual-axis temptation, and a
dual axis invents a correlation — where the two scales are pinned is arbitrary,
so the reader sees a relationship that is an artefact of the layout. The trend
widget is instead two stacked panels sharing one set of period categories and
identical margins: revenue columns above, margin line below. It reads as a
single figure, and each series keeps an honest scale.

**Values are never gated behind a hover.** Each chart panel prints its latest
value in the panel header, the axes carry the rest, and the statement table on
the same tab is the chart's table-view twin — every plotted number appears there
as text. The segment mix has no table twin, so its `aria-label` enumerates every
period's shares, not just the latest. The segment legend carries each segment's
name and latest value, which keeps series slots 3–5 readable: those sit below
3:1 contrast on white, so they must never be identified by hue alone.

Axis ticks are computed rather than left to Recharts, which was producing scales
like `30 · 26 · 24 · 22` — uneven steps that misstate the spacing between
gridlines. The ₹ crore axis picks lakh-or-grouped once from the series maximum,
so a single axis never mixes `1.0L` with `75,000`.

## Accessibility

- Tabs follow the WAI-ARIA tabs pattern with **manual activation**: roving
  tabindex, Left/Right with wraparound, Home/End, Enter or Space to select.
- The company switcher is an ARIA combobox with an attached listbox:
  `aria-expanded`, `aria-controls`, `aria-activedescendant`, Up/Down/Home/End,
  Enter to commit, Escape to cancel.
- The period control is a native radio group in a `fieldset`, so arrow-key
  behaviour and group semantics come from the platform.
- Statement and peer tables use real `<th>` with `scope`, so a screen reader
  announces each figure with its row and column.
- Charts expose a text equivalent via `role="img"` and an `aria-label` that
  states the values, so nothing meaningful is reachable only by hovering.
- One focus treatment, defined once in `styles/index.css`, on every interactive
  element.
- Every text/background pair meets WCAG AA (≥ 4.5:1). Status colours used on
  badges (live/mock, KPI up/down, tracked/carried) were checked on their own
  soft backgrounds and pass AA.
- Delta direction is carried by an arrow glyph and the sign in the label, not by
  colour alone.
- `prefers-reduced-motion` stops the shimmer and all transitions.

---

## Not yet built

BSE fallback for figures Screener omits, quarterly segment scraping, per-company
routing/deep-links, and dark mode. Peer comparison is still carried from mock
sector data rather than assembled from each peer's own scraped statements.
