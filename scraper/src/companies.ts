/**
 * The five tracked companies mapped to their Screener.in URL symbols.
 *
 * `companyId` is the join key used everywhere in the app — it matches
 * `MockCompany.id` in `src/mocks/companies.ts` and `CompanyFinancials.companyId`
 * in the schema. The symbols are the slugs Screener uses in its company URLs
 * (`https://www.screener.in/company/<symbol>/`). Kept as a hardcoded table
 * rather than imported from the frontend so the scraper has no dependency on
 * `src/`.
 */

export interface ScraperCompany {
  /** Joins to `MockCompany.id` and `CompanyFinancials.companyId`. */
  readonly companyId: string
  /** Screener.in URL symbol, e.g. `RELIANCE`. Also the output filename stem. */
  readonly screenerSymbol: string
  /** Display name, for logs. */
  readonly name: string
}

export const SCRAPER_COMPANIES: readonly ScraperCompany[] = [
  { companyId: 'reliance-industries', screenerSymbol: 'RELIANCE', name: 'Reliance Industries' },
  { companyId: 'tata-consultancy-services', screenerSymbol: 'TCS', name: 'Tata Consultancy Services' },
  { companyId: 'hdfc-bank', screenerSymbol: 'HDFCBANK', name: 'HDFC Bank' },
  { companyId: 'infosys', screenerSymbol: 'INFY', name: 'Infosys' },
  { companyId: 'hindustan-unilever', screenerSymbol: 'HINDUNILVR', name: 'Hindustan Unilever' },
]

/** Resolve a `--company` argument (a Screener symbol or a companyId) to a company. */
export function findScraperCompany(query: string): ScraperCompany | undefined {
  const symbol = query.trim().toUpperCase()
  const id = query.trim().toLowerCase()
  return SCRAPER_COMPANIES.find(
    (company) => company.screenerSymbol === symbol || company.companyId === id,
  )
}
