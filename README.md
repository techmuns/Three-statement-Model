# Vittara

Multi-company financial analytics dashboard for Indian listed companies.

**Phase 1 — visual shell only.** Every number on screen is hardcoded. There is no
scraper, no API, no backend and no data schema yet; this phase exists to lock in
the layout, navigation, design tokens and widget states that later phases build on.

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
    │   └── navigation.ts       tab / sub-tab / period definitions and defaults
    ├── lib/
    │   └── cn.ts               conditional class-name join
    ├── hooks/
    │   └── useOnClickOutside.ts
    ├── mocks/
    │   ├── companies.ts        5 hardcoded companies + search helper
    │   └── placeholders.ts     static widget content, varies by period
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

Screener.in scraper, BSE fallback, GitHub Actions, the real data schema, API
calls, peer-comparison logic, charts, routing, dark mode.
