# Vittara scraper

Backend-only Screener.in scraper. It logs in, reads each company's statement
tables, and writes one `CompanyFinancials` JSON file per company to the
repo-root `data/` directory. It is **not** wired into the dashboard — that is a
later phase. Nothing here imports from or modifies `src/` (the frontend); it
only reuses the schema **types** from `src/types/`.

## Setup

```bash
cd scraper
npm install                 # Playwright + tooling (browser download is skipped
                            # where a system Chromium is already provided)
cp .env.example .env        # then put real credentials in scraper/.env
```

Credentials come from `SCREENER_EMAIL` and `SCREENER_PASSWORD`, read from
`scraper/.env` (gitignored) or the ambient environment. They are never
hardcoded, printed, or written to disk.

## Run

From the scraper directory:

```bash
npm run scrape -- --company=RELIANCE   # one company
npm run scrape:all                     # all five companies
npm run typecheck                      # types only, no browser
```

Or from the repo root (convenience passthroughs):

```bash
npm run scrape -- --company=RELIANCE
npm run scrape:all
```

Output lands in `data/RELIANCE.json`, `data/TCS.json`, etc. Those JSON files are
gitignored (generated per run); the `data/` directory itself is kept.

## What it extracts

Per company, into the exact `src/types/financials.ts` shapes:

| Statement            | Cadence   | Source section     | Availability                  |
| -------------------- | --------- | ------------------ | ----------------------------- |
| Profit & Loss        | quarterly | `#quarters`        | available (last 5 quarters)   |
| Profit & Loss        | annual    | `#profit-loss`     | available (last 5 FYs)        |
| Balance Sheet        | annual    | `#balance-sheet`   | available (last 5 FYs)        |
| Cash Flow            | annual    | `#cash-flow`       | available (last 5 FYs)        |
| Balance Sheet / Cash Flow | quarterly | —             | `unavailable` / `not-reported`|
| Segment mix          | both      | —                  | `unavailable` / `not-scraped` |

- **Banking layout** (banks/NBFCs) is detected from the P&L rows (a `Financing
  Profit` row instead of `Operating Profit`) and mapped to
  `statementLayout: 'banking'` with `interest` as interest *expended* — never
  forced into the standard layout.
- **Basis** (consolidated vs standalone) is detected from the page and recorded
  in `DataSource.basis`, alongside the source URL and a `fetchedAt` timestamp.
- **Derived percentages.** Screener prints OPM %/Financing Margin % and Tax % as
  integers, so those are derived from the exact ₹-crore lines
  (`operating profit ÷ sales`, `1 − PAT ÷ PBT`) rather than read rounded.
- **Missing values** use the schema conventions: a blank cell (e.g. a lender's
  CWIP) is `null`, never `0`; an absent statement is `Availability` `unavailable`
  with a reason, never a fabricated block of zeros.

## Fragile assumptions

Scraper reliability depends on Screener's page structure. If Screener changes
any of these, the corresponding parser throws a loud, specific error:

- **URLs**: login at `/login/`; company page at
  `/company/<symbol>/consolidated/`.
- **Login form**: a username (email) field, a password field, a submit button;
  success navigates away from `/login/`.
- **Section ids**: `quarters`, `profit-loss`, `balance-sheet`, `cash-flow`.
- **Table**: the statement is the first `table.data-table` in its section, with
  a `thead` of `Mon YYYY` period columns (annual P&L also carries a `TTM` column
  that is skipped) and one `tbody` row per line item, the label in the first
  cell.
- **Row labels**: matched case-insensitively — `Sales`/`Revenue`, `Expenses`,
  `Operating Profit`/`Financing Profit`, `Other Income`, `Interest`,
  `Depreciation`, `Profit before tax`, `Net Profit`, `EPS in Rs`; balance-sheet
  and cash-flow lines by their Screener names.
- **Basis marker**: the text `"Consolidated Figures…"` / `"Standalone Figures…"`.
- **Numbers**: comma-grouped, `%`-suffixed percents, `-` negatives; a blank or
  lone dash means not-reported.

## Layout

```
scraper/
├── package.json            self-contained project (Playwright, tsx, TypeScript)
├── tsconfig.json           strict; @/ → ../src for the shared schema types
├── .env.example            credential template (copy to .env)
└── src/
    ├── cli.ts              entry: arg parsing, orchestration, polite delays
    ├── companies.ts        the 5 companies → Screener symbols
    ├── env.ts              credentials from env/.env (never logged)
    ├── browser.ts          launch + one reused logged-in context
    ├── scrape.ts           navigate one company, gather sections
    ├── extract.ts          DOM → raw header/row strings; basis detection
    ├── normalize.ts        raw tables → CompanyFinancials (layout, Availability)
    ├── periods.ts          Screener column header → PeriodRef
    ├── numbers.ts          cell string → Reported<number>
    └── output.ts           write data/<SYMBOL>.json
```
