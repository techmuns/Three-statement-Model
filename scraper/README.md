# Vittara scraper

Backend-only Screener.in scraper. It logs in, reads each company's statement
tables and its peer-comparison table, and writes one `CompanyFinancials` JSON
per company to `data/` plus one `PeerGroup` JSON per sector to
`data/peer-groups/`. It is **not** wired into the dashboard — that is a later
phase. Nothing here imports from or modifies `src/` (the frontend); it only
reuses the schema **types** from `src/types/`.

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

Per-company financials land in `data/RELIANCE.json`, `data/TCS.json`, etc.;
sector peer groups land in `data/peer-groups/<group-id>.json`. All are gitignored
(generated per run); the directories themselves are kept.

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
| Peer comparison      | snapshot  | `#peers` (AJAX)    | `data/peer-groups/<id>.json`  |

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

### Peers

Screener's peer-comparison table (loaded into `#peers` by a client-side request)
carries these columns: **S.No, Name, CMP, P/E, Mar Cap, Div Yld, NP Qtr, Qtr
Profit Var %, Sales Qtr, Qtr Sales Var %, ROCE %**. Of our six KPIs, only
**ROCE** is present, so it is the only one carried; the other five
(revenue growth, OPM %, NPM %, ROE, D/E) are `null` — never guessed or derived
from the unrelated columns. Market cap maps to `PeerCompany.marketCapCrore`.

A peer whose URL symbol matches one of our five tracked companies is a
**derived** member (it has its own fully scraped statements) and is left out of
the carried list; every other peer is **carried** with only its snapshot values.
The table is a point-in-time snapshot, so carried peers hold no history — the
`PeerCompany` shape has no trend field, so none is fabricated. Peers are grouped
by sector into `PeerGroup`s and written to `data/peer-groups/<group-id>.json`.
`scrape:all` produces complete groups; a single-company run produces its group
from that company's peer table only.

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
- **Peers table**: a `table.data-table` loaded into `#peers` /
  `#peers-table-placeholder` after page load; row 0 is the header, each data row
  links to `/company/<symbol>/`, and a `ROCE %` and a `Mar Cap` column are
  present (a missing ROCE or market-cap column raises a loud error).
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
    ├── scrape.ts           navigate one company, gather sections + peer table
    ├── extract.ts          DOM → raw strings (statements + peers); basis detection
    ├── normalize.ts        raw tables → CompanyFinancials (layout, Availability)
    ├── peerGroups.ts       the 4 sector cohorts → tracked members
    ├── peers.ts            peer table → PeerGroup (ROCE-only, derived vs carried)
    ├── periods.ts          Screener column header → PeriodRef
    ├── numbers.ts          cell string → Reported<number>
    └── output.ts           write data/<SYMBOL>.json + data/peer-groups/<id>.json
```
