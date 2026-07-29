# Vittara

Multi-company financial analytics dashboard for Indian listed companies.

**Phase 2 — schema and mock data.** The dashboard shell renders placeholder
content from `src/mocks/placeholders.ts`. Alongside it now sits the real data
schema (`src/types/`) and a realistic mock dataset for the five tracked
companies (`src/mocks/financials.ts`, `kpis.ts`, `peers.ts`). Nothing in the
views reads it yet — wiring is the next phase. There is still no scraper, no
API and no backend.

---

## Commands

```bash
npm install          # once

npm run dev          # local dev server (Vite, http://localhost:5173)
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build locally
npm run typecheck    # types only, no build
```

### Deploying to Cloudflare Workers

`wrangler.jsonc` is configured for a static-assets-only Worker: Cloudflare serves
`dist/` from the edge and no Worker script runs.

```bash
npx wrangler login          # once, per machine
npm run cf:deploy           # build + wrangler deploy
```

Other useful commands:

```bash
npm run cf:preview          # build + wrangler dev (Workers runtime, locally)
npx wrangler deploy --dry-run   # validate config without deploying
```

`not_found_handling: "single-page-application"` means unknown paths return
`index.html`, so client-side routing will work when it is added.

---

## Folder structure

```
.
├── index.html                  Vite entry document
├── vite.config.ts              Vite + React + Tailwind v4 plugin, `@/` alias
├── wrangler.jsonc              Cloudflare Workers static-assets config
├── tsconfig.json               project references
├── tsconfig.app.json           app compiler options (strict)
├── tsconfig.node.json          build-tooling compiler options
├── public/
│   └── favicon.svg             inline gradient mark, no raster assets
└── src/
    ├── main.tsx                React root
    ├── App.tsx                 all dashboard state lives here
    ├── styles/
    │   └── index.css           Tailwind import, base layer, shimmer keyframes
    ├── theme/
    │   ├── theme.css           ★ CANONICAL DESIGN TOKENS
    │   └── tokens.ts           typed `var(--…)` accessors for JS/SVG consumers
    ├── config/
    │   ├── app.ts              app name, tagline
    │   ├── navigation.ts       tab / sub-tab / period definitions and defaults
    │   └── kpis.ts             the standard KPI definitions (label, unit, formula)
    ├── types/                  ★ THE DATA SCHEMA
    │   ├── common.ts           units, Reported<T>, Availability<T>, DataSource
    │   ├── period.ts           PeriodRef, cadence, Indian FY conventions
    │   ├── financials.ts       P&L / balance sheet / cash flow / segments
    │   ├── kpi.ts              KPI definitions, values, peer stats
    │   └── peers.ts            peer groups and comparison rows
    ├── lib/
    │   └── cn.ts               conditional class-name join
    ├── hooks/
    │   └── useOnClickOutside.ts
    ├── mocks/
    │   ├── companies.ts        5 hardcoded companies + search helper
    │   ├── periods.ts          the 5 quarters and 5 years everything keys to
    │   ├── financials.ts       authored inputs → derived statements
    │   ├── peers.ts            4 sector cohorts with carried peer KPIs
    │   ├── kpis.ts             KPIs derived from the statements + peer stats
    │   └── placeholders.ts     static widget content for the shell (phase 1)
    ├── components/
    │   ├── layout/
    │   │   ├── AppShell.tsx        skip link, page wash, main, footer
    │   │   ├── AppHeader.tsx       sticky header: wordmark, switcher, tabs
    │   │   ├── Wordmark.tsx        logo glyph + gradient wordmark
    │   │   └── PageToolbar.tsx     view title + control strip
    │   ├── nav/
    │   │   ├── Tabs.tsx            ARIA tabs (primary + sub variants), TabPanel
    │   │   └── SegmentedControl.tsx single-choice control on native radios
    │   ├── company/
    │   │   ├── CompanySwitcher.tsx searchable ARIA combobox
    │   │   └── CompanyAvatar.tsx   monogram stand-in for a logo
    │   └── widgets/
    │       ├── WidgetCard.tsx      ★ the one card shell
    │       ├── WidgetGrid.tsx      responsive auto-fill grid
    │       ├── WidgetSkeleton.tsx  ★ shimmer loading state
    │       ├── WidgetEmptyState.tsx ★ empty state
    │       ├── StatTile.tsx        StatTile + StatList
    │       ├── DeltaBadge.tsx      period-on-period change pill
    │       └── widgetState.ts      'ready' | 'loading' | 'empty'
    └── views/
        ├── financials/
        │   └── FinancialsView.tsx  period toggle + P&L / BS / CF sub-tabs
        ├── kpi/
        │   └── KpiOverviewView.tsx
        └── shared/
            └── WidgetDeck.tsx      maps widget definitions → cards + states
```

---

## Naming conventions

Keep future phases consistent with these:

| Thing | Convention | Example |
|---|---|---|
| Component file | `PascalCase.tsx`, one main component per file, named export | `WidgetCard.tsx` |
| Non-component module | `camelCase.ts` | `useOnClickOutside.ts`, `widgetState.ts` |
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
later touches one file.

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

`src/types/` is the contract the Screener.in scraper must satisfy. Three things
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
absent from the Screener company page.

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

### Mock data

`mocks/financials.ts` authors *inputs* and derives everything implied by them,
so the accounting identities hold by construction: the balance sheet balances,
CFO is the sum of its parts, segment revenues sum exactly to sales, and the four
FY26 quarters sum to the FY26 annual column. Scale and ratios are modelled on
the real companies so derived KPIs land in the right neighbourhood — but every
figure is invented and none should be quoted as fact.

`mocks/kpis.ts` computes the KPI set from those statements rather than authoring
it, so a KPI cannot contradict the statement it summarises. The real pipeline
will do the same thing with real inputs.

## Accessibility

- Tabs follow the WAI-ARIA tabs pattern with **manual activation**: roving
  tabindex, Left/Right with wraparound, Home/End, Enter or Space to select.
  Manual rather than automatic because a later phase will fetch on tab change,
  and arrowing across would fire every request in between.
- The company switcher is an ARIA combobox with an attached listbox:
  `aria-expanded`, `aria-controls`, `aria-activedescendant`, Up/Down/Home/End,
  Enter to commit, Escape to cancel.
- The period and preview controls are native radio groups in a `fieldset`, so
  arrow-key behaviour and group semantics come from the platform.
- One focus treatment, defined once in `styles/index.css`, on every interactive
  element.
- Every text/background pair meets WCAG AA (≥ 4.5:1); the lightest ink token is
  5.4:1 on the page surface.
- Delta direction is carried by an arrow glyph and the sign in the label, not by
  colour alone.
- `prefers-reduced-motion` stops the shimmer and all transitions.

---

## Not in this phase

Screener.in scraper, BSE fallback, GitHub Actions, API calls, charts, routing,
dark mode — and wiring the schema above into the views, which still render the
phase-1 placeholders.
