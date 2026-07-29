/**
 * Hardcoded companies for the shell phase.
 *
 * Deliberately NOT the eventual data model — this is only what the header
 * needs to render a switcher. Tickers and sectors are illustrative. The real
 * company list arrives with the Screener.in ingest in a later phase; when it
 * does, this file is replaced, not extended.
 */

export interface MockCompany {
  id: string
  name: string
  /** Illustrative — not a real exchange symbol. */
  ticker: string
  sector: string
  /** Two-letter monogram used in place of a logo asset. */
  monogram: string
  /** Series slot (0-based) used to tint the monogram, so a company keeps the
   * same colour wherever it appears. */
  colorIndex: number
}

export const MOCK_COMPANIES: readonly MockCompany[] = [
  {
    id: 'reliance-industries',
    name: 'Reliance Industries',
    ticker: 'RELIND',
    sector: 'Oil, Gas & Consumer',
    monogram: 'RI',
    colorIndex: 0,
  },
  {
    id: 'tata-consultancy-services',
    name: 'Tata Consultancy Services',
    ticker: 'TCSVC',
    sector: 'IT Services',
    monogram: 'TC',
    colorIndex: 1,
  },
  {
    id: 'hdfc-bank',
    name: 'HDFC Bank',
    ticker: 'HDFCB',
    sector: 'Private Sector Bank',
    monogram: 'HB',
    colorIndex: 2,
  },
  {
    id: 'infosys',
    name: 'Infosys',
    ticker: 'INFYS',
    sector: 'IT Services',
    monogram: 'IN',
    colorIndex: 3,
  },
  {
    id: 'hindustan-unilever',
    name: 'Hindustan Unilever',
    ticker: 'HULEV',
    sector: 'FMCG',
    monogram: 'HU',
    colorIndex: 4,
  },
]

export const DEFAULT_COMPANY_ID = MOCK_COMPANIES[0].id

export function findCompany(id: string): MockCompany {
  return MOCK_COMPANIES.find((company) => company.id === id) ?? MOCK_COMPANIES[0]
}

/** Case-insensitive match across name, ticker and sector. */
export function searchCompanies(query: string): readonly MockCompany[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return MOCK_COMPANIES

  return MOCK_COMPANIES.filter((company) =>
    `${company.name} ${company.ticker} ${company.sector}`.toLowerCase().includes(needle),
  )
}
