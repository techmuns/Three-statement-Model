/**
 * Realistic mock financials for the five tracked companies.
 *
 * The figures are authored as **inputs** (sales, expenses, other income,
 * interest, depreciation, tax rate, and the balance-sheet and cash-flow lines
 * that are not implied by others) and the derived lines are computed. That way
 * the accounting identities hold by construction rather than by careful typing:
 *
 *   operating profit = sales − expenses            (− interest, banking layout)
 *   profit before tax = operating profit + other income − interest − depreciation
 *   net profit = profit before tax × (1 − tax rate)
 *   EPS = net profit ÷ shares outstanding
 *   total assets = total liabilities
 *   cash from operations = pre-working-capital profit + WC movement + tax paid
 *   net cash flow = CFO + CFI + CFF
 *   segment revenues sum exactly to sales
 *
 * The four FY26 quarters also sum exactly to the FY26 annual column for sales,
 * expenses, other income, interest and depreciation — as they do in a real
 * filing. Net profit differs by a few crore because each quarter carries its
 * own effective tax rate and the annual figure is the blend; that mismatch is
 * itself realistic.
 *
 * Scale and ratios are modelled on the real companies so derived KPIs land in
 * the right neighbourhood, but every number here is invented and none should be
 * quoted as reported fact.
 */

import type { Crore, DataSource, Percent, Reported } from '@/types/common'
import type {
  BalanceSheetPeriod,
  CashFlowPeriod,
  CompanyFinancials,
  ProfitLossPeriod,
  RevenueSegment,
  SegmentMix,
  SegmentRevenue,
  StatementLayout,
  StatementSet,
} from '@/types/financials'
import type { PeriodRef } from '@/types/period'
import { getScrapedFinancials } from '@/data/scrapedFinancials'
import { ANNUAL_PERIODS, QUARTERLY_PERIODS } from './periods'

/* -------------------------------------------------------------------------- */
/* Authoring inputs                                                           */
/* -------------------------------------------------------------------------- */

interface ProfitLossInput {
  readonly sales: Crore
  readonly expenses: Crore
  readonly otherIncome: Crore
  readonly interest: Crore
  readonly depreciation: Crore
  readonly taxPercent: Percent
}

interface BalanceSheetInput {
  readonly equityCapital: Crore
  readonly reserves: Crore
  readonly borrowings: Crore
  readonly otherLiabilities: Crore
  readonly fixedAssets: Crore
  /** `null` where the source leaves the line blank — the case for lenders. */
  readonly cwip: Reported<Crore>
  readonly investments: Crore
}

interface CashFlowInput {
  readonly operatingProfitBeforeWorkingCapital: Crore
  readonly workingCapitalChange: Crore
  readonly taxPaid: Crore
  readonly cashFromInvesting: Crore
  readonly cashFromFinancing: Crore
}

interface SegmentMixInput {
  /** Segments whose share of sales is authored, one entry per period. */
  readonly leading: readonly {
    readonly id: string
    readonly name: string
    readonly sharePercent: readonly Percent[]
  }[]
  /** Takes the residual, so segment revenues sum exactly to sales. */
  readonly balancing: { readonly id: string; readonly name: string }
}

interface CompanyInput {
  readonly companyId: string
  readonly statementLayout: StatementLayout
  readonly sharesOutstandingCrore: number
  /** Five quarters, oldest → newest, aligned to `QUARTERLY_PERIODS`. */
  readonly quarterlyProfitLoss: readonly ProfitLossInput[]
  /** Five years, oldest → newest, aligned to `ANNUAL_PERIODS`. */
  readonly annualProfitLoss: readonly ProfitLossInput[]
  readonly annualBalanceSheet: readonly BalanceSheetInput[]
  readonly annualCashFlow: readonly CashFlowInput[]
  readonly annualSegments: SegmentMixInput
}

/* -------------------------------------------------------------------------- */
/* Derivation                                                                 */
/* -------------------------------------------------------------------------- */

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function buildProfitLoss(
  period: PeriodRef,
  input: ProfitLossInput,
  layout: StatementLayout,
  sharesOutstandingCrore: number,
): ProfitLossPeriod {
  // On the banking layout interest is expended against revenue, so it lands
  // above the operating-profit line rather than below it.
  const operatingProfit =
    layout === 'banking'
      ? input.sales - input.expenses - input.interest
      : input.sales - input.expenses

  const profitBeforeTax =
    layout === 'banking'
      ? operatingProfit + input.otherIncome - input.depreciation
      : operatingProfit + input.otherIncome - input.interest - input.depreciation

  const netProfit = round(profitBeforeTax * (1 - input.taxPercent / 100), 0)

  return {
    period,
    sales: input.sales,
    expenses: input.expenses,
    operatingProfit,
    opmPercent: round((operatingProfit / input.sales) * 100, 2),
    otherIncome: input.otherIncome,
    interest: input.interest,
    depreciation: input.depreciation,
    profitBeforeTax,
    taxPercent: input.taxPercent,
    netProfit,
    eps: round(netProfit / sharesOutstandingCrore, 2),
  }
}

function buildBalanceSheet(period: PeriodRef, input: BalanceSheetInput): BalanceSheetPeriod {
  const totalLiabilities =
    input.equityCapital + input.reserves + input.borrowings + input.otherLiabilities

  // The residual asset line balances the sheet. A blank CWIP contributes
  // nothing rather than being read as zero elsewhere.
  const otherAssets =
    totalLiabilities - (input.fixedAssets + (input.cwip ?? 0) + input.investments)

  return {
    period,
    equityCapital: input.equityCapital,
    reserves: input.reserves,
    borrowings: input.borrowings,
    otherLiabilities: input.otherLiabilities,
    totalLiabilities,
    fixedAssets: input.fixedAssets,
    cwip: input.cwip,
    investments: input.investments,
    otherAssets,
    totalAssets: totalLiabilities,
  }
}

function buildCashFlow(period: PeriodRef, input: CashFlowInput): CashFlowPeriod {
  const cashFromOperating =
    input.operatingProfitBeforeWorkingCapital + input.workingCapitalChange + input.taxPaid

  return {
    period,
    operatingProfitBeforeWorkingCapital: input.operatingProfitBeforeWorkingCapital,
    workingCapitalChange: input.workingCapitalChange,
    taxPaid: input.taxPaid,
    cashFromOperating,
    cashFromInvesting: input.cashFromInvesting,
    cashFromFinancing: input.cashFromFinancing,
    netCashFlow: cashFromOperating + input.cashFromInvesting + input.cashFromFinancing,
  }
}

function buildSegments(
  input: SegmentMixInput,
  periods: readonly PeriodRef[],
  profitLoss: readonly ProfitLossPeriod[],
): readonly RevenueSegment[] {
  const leadingValues: SegmentRevenue[][] = input.leading.map(() => [])
  const balancingValues: SegmentRevenue[] = []

  periods.forEach((period, periodIndex) => {
    const sales = profitLoss[periodIndex].sales
    let allocated = 0

    input.leading.forEach((segment, segmentIndex) => {
      const revenue = Math.round((sales * segment.sharePercent[periodIndex]) / 100)
      allocated += revenue
      leadingValues[segmentIndex].push({
        periodId: period.id,
        revenue,
        sharePercent: round((revenue / sales) * 100, 1),
      })
    })

    const residual = sales - allocated
    balancingValues.push({
      periodId: period.id,
      revenue: residual,
      sharePercent: round((residual / sales) * 100, 1),
    })
  })

  return [
    ...input.leading.map((segment, index) => ({
      id: segment.id,
      name: segment.name,
      values: leadingValues[index],
    })),
    { id: input.balancing.id, name: input.balancing.name, values: balancingValues },
  ]
}

/**
 * Quarterly balance sheets and cash flow statements are not published by
 * Indian filers at this cadence — SEBI LODR requires them half-yearly and
 * Screener exposes annual columns only. Modelled as genuinely unavailable
 * rather than as an empty array, so the UI can say why.
 */
const QUARTERLY_STATEMENT_UNAVAILABLE = {
  status: 'unavailable',
  reason: 'not-reported',
  note: 'Indian filers report the balance sheet and cash flow statement half-yearly at the earliest; Screener publishes annual columns only.',
} as const

const QUARTERLY_SEGMENTS_UNAVAILABLE: SegmentMix = {
  status: 'unavailable',
  reason: 'not-scraped',
  note: 'Quarterly segment disclosure is filed with the exchange but is not exposed on the Screener company page.',
}

const MOCK_SOURCE: DataSource = {
  provider: 'mock',
  fetchedAt: '2026-07-29T00:00:00.000Z',
  basis: 'consolidated',
}

function buildFinancials(input: CompanyInput): CompanyFinancials {
  const quarterlyProfitLoss = QUARTERLY_PERIODS.map((period, index) =>
    buildProfitLoss(
      period,
      input.quarterlyProfitLoss[index],
      input.statementLayout,
      input.sharesOutstandingCrore,
    ),
  )

  const annualProfitLoss = ANNUAL_PERIODS.map((period, index) =>
    buildProfitLoss(
      period,
      input.annualProfitLoss[index],
      input.statementLayout,
      input.sharesOutstandingCrore,
    ),
  )

  const quarterly: StatementSet = {
    cadence: 'quarterly',
    profitLoss: { status: 'available', periods: quarterlyProfitLoss },
    balanceSheet: QUARTERLY_STATEMENT_UNAVAILABLE,
    cashFlow: QUARTERLY_STATEMENT_UNAVAILABLE,
    segmentMix: QUARTERLY_SEGMENTS_UNAVAILABLE,
  }

  const annual: StatementSet = {
    cadence: 'annual',
    profitLoss: { status: 'available', periods: annualProfitLoss },
    balanceSheet: {
      status: 'available',
      periods: ANNUAL_PERIODS.map((period, index) =>
        buildBalanceSheet(period, input.annualBalanceSheet[index]),
      ),
    },
    cashFlow: {
      status: 'available',
      periods: ANNUAL_PERIODS.map((period, index) =>
        buildCashFlow(period, input.annualCashFlow[index]),
      ),
    },
    segmentMix: {
      status: 'available',
      segments: buildSegments(input.annualSegments, ANNUAL_PERIODS, annualProfitLoss),
    },
  }

  return {
    companyId: input.companyId,
    currency: 'INR',
    unit: 'crore',
    statementLayout: input.statementLayout,
    fiscalYearEndMonth: 3,
    sharesOutstandingCrore: input.sharesOutstandingCrore,
    source: MOCK_SOURCE,
    quarterly,
    annual,
  }
}

/* -------------------------------------------------------------------------- */
/* Authored inputs, per company                                               */
/* -------------------------------------------------------------------------- */

const RELIANCE: CompanyInput = {
  companyId: 'RELIANCE',
  statementLayout: 'standard',
  sharesOutstandingCrore: 1353,
  quarterlyProfitLoss: [
    { sales: 248160, expenses: 205102, otherIncome: 4310, interest: 6248, depreciation: 13825, taxPercent: 23.6 },
    { sales: 256420, expenses: 211840, otherIncome: 3985, interest: 6392, depreciation: 14106, taxPercent: 23.9 },
    { sales: 264830, expenses: 218963, otherIncome: 4126, interest: 6455, depreciation: 14312, taxPercent: 23.7 },
    { sales: 263070, expenses: 216229, otherIncome: 3989, interest: 6023, depreciation: 14499, taxPercent: 24.0 },
    { sales: 271940, expenses: 223118, otherIncome: 4562, interest: 6187, depreciation: 14876, taxPercent: 23.9 },
  ],
  annualProfitLoss: [
    { sales: 698672, expenses: 585896, otherIncome: 8931, interest: 14584, depreciation: 29782, taxPercent: 22.4 },
    { sales: 876396, expenses: 741822, otherIncome: 10261, interest: 19571, depreciation: 40303, taxPercent: 22.6 },
    { sales: 917130, expenses: 763268, otherIncome: 12345, interest: 23138, depreciation: 50537, taxPercent: 23.1 },
    { sales: 964693, expenses: 801246, otherIncome: 14892, interest: 24269, depreciation: 53230, taxPercent: 23.5 },
    { sales: 1032480, expenses: 852134, otherIncome: 16410, interest: 25118, depreciation: 56742, taxPercent: 23.8 },
  ],
  annualBalanceSheet: [
    { equityCapital: 13530, reserves: 693111, borrowings: 266305, otherLiabilities: 265432, fixedAssets: 490537, cwip: 71575, investments: 258823 },
    { equityCapital: 13530, reserves: 731963, borrowings: 315161, otherLiabilities: 292140, fixedAssets: 596141, cwip: 90276, investments: 274613 },
    { equityCapital: 13530, reserves: 786715, borrowings: 328593, otherLiabilities: 314826, fixedAssets: 802955, cwip: 65612, investments: 291480 },
    { equityCapital: 13530, reserves: 852410, borrowings: 341052, otherLiabilities: 336218, fixedAssets: 862340, cwip: 72180, investments: 312460 },
    { equityCapital: 13530, reserves: 928640, borrowings: 324880, otherLiabilities: 358940, fixedAssets: 918260, cwip: 68420, investments: 340180 },
  ],
  annualCashFlow: [
    { operatingProfitBeforeWorkingCapital: 112340, workingCapitalChange: -18420, taxPaid: -12180, cashFromInvesting: -75620, cashFromFinancing: -8940 },
    { operatingProfitBeforeWorkingCapital: 128760, workingCapitalChange: -22140, taxPaid: -14380, cashFromInvesting: -118420, cashFromFinancing: 24680 },
    { operatingProfitBeforeWorkingCapital: 156320, workingCapitalChange: -19860, taxPaid: -16240, cashFromInvesting: -132480, cashFromFinancing: 15340 },
    { operatingProfitBeforeWorkingCapital: 168420, workingCapitalChange: -21340, taxPaid: -17820, cashFromInvesting: -124680, cashFromFinancing: -8420 },
    { operatingProfitBeforeWorkingCapital: 182640, workingCapitalChange: -16280, taxPaid: -19240, cashFromInvesting: -118460, cashFromFinancing: -22380 },
  ],
  annualSegments: {
    leading: [
      { id: 'o2c', name: 'Oil to Chemicals', sharePercent: [58.4, 57.1, 55.8, 54.6, 53.2] },
      { id: 'retail', name: 'Retail', sharePercent: [24.1, 25.0, 25.8, 26.4, 27.1] },
      { id: 'digital-services', name: 'Digital Services', sharePercent: [10.8, 11.3, 11.9, 12.4, 13.0] },
    ],
    balancing: { id: 'oil-gas-other', name: 'Oil & Gas and Others' },
  },
}

const TCS: CompanyInput = {
  companyId: 'TCS',
  statementLayout: 'standard',
  sharesOutstandingCrore: 362,
  quarterlyProfitLoss: [
    { sales: 66120, expenses: 49812, otherIncome: 1345, interest: 214, depreciation: 1332, taxPercent: 25.3 },
    { sales: 67480, expenses: 50682, otherIncome: 1398, interest: 218, depreciation: 1358, taxPercent: 25.4 },
    { sales: 68420, expenses: 51306, otherIncome: 1420, interest: 220, depreciation: 1385, taxPercent: 25.5 },
    { sales: 69660, expenses: 52164, otherIncome: 1457, interest: 220, depreciation: 1405, taxPercent: 25.4 },
    { sales: 71240, expenses: 53338, otherIncome: 1512, interest: 226, depreciation: 1442, taxPercent: 25.6 },
  ],
  annualProfitLoss: [
    { sales: 191754, expenses: 143869, otherIncome: 3260, interest: 784, depreciation: 4604, taxPercent: 25.5 },
    { sales: 225458, expenses: 171149, otherIncome: 3390, interest: 779, depreciation: 4629, taxPercent: 25.6 },
    { sales: 240893, expenses: 180265, otherIncome: 4592, interest: 807, depreciation: 4985, taxPercent: 25.6 },
    { sales: 255324, expenses: 192348, otherIncome: 5140, interest: 843, depreciation: 5210, taxPercent: 25.5 },
    { sales: 271680, expenses: 203964, otherIncome: 5620, interest: 872, depreciation: 5480, taxPercent: 25.4 },
  ],
  annualBalanceSheet: [
    { equityCapital: 366, reserves: 88773, borrowings: 7818, otherLiabilities: 32104, fixedAssets: 11871, cwip: 1122, investments: 45210 },
    { equityCapital: 366, reserves: 89139, borrowings: 7860, otherLiabilities: 34952, fixedAssets: 12455, cwip: 968, investments: 46830 },
    { equityCapital: 362, reserves: 90127, borrowings: 8214, otherLiabilities: 37680, fixedAssets: 13012, cwip: 842, investments: 49120 },
    { equityCapital: 362, reserves: 95420, borrowings: 8460, otherLiabilities: 40125, fixedAssets: 13680, cwip: 910, investments: 52340 },
    { equityCapital: 362, reserves: 101860, borrowings: 8720, otherLiabilities: 42980, fixedAssets: 14320, cwip: 1050, investments: 56180 },
  ],
  annualCashFlow: [
    { operatingProfitBeforeWorkingCapital: 51240, workingCapitalChange: -3180, taxPaid: -10940, cashFromInvesting: -6420, cashFromFinancing: -30180 },
    { operatingProfitBeforeWorkingCapital: 57680, workingCapitalChange: -4210, taxPaid: -11860, cashFromInvesting: -3840, cashFromFinancing: -38620 },
    { operatingProfitBeforeWorkingCapital: 64320, workingCapitalChange: -2980, taxPaid: -12740, cashFromInvesting: -8120, cashFromFinancing: -39480 },
    { operatingProfitBeforeWorkingCapital: 66840, workingCapitalChange: -3620, taxPaid: -13180, cashFromInvesting: -5460, cashFromFinancing: -43120 },
    { operatingProfitBeforeWorkingCapital: 71480, workingCapitalChange: -2840, taxPaid: -13920, cashFromInvesting: -7280, cashFromFinancing: -46180 },
  ],
  annualSegments: {
    leading: [
      { id: 'bfsi', name: 'Banking, Financial Services & Insurance', sharePercent: [38.4, 38.0, 37.6, 37.9, 37.8] },
      { id: 'consumer-business', name: 'Consumer Business', sharePercent: [15.2, 15.4, 15.7, 15.5, 15.6] },
      { id: 'life-sciences', name: 'Life Sciences & Healthcare', sharePercent: [10.4, 10.6, 10.9, 10.7, 10.8] },
    ],
    balancing: { id: 'technology-services', name: 'Technology, Communications & Others' },
  },
}

const HDFC_BANK: CompanyInput = {
  companyId: 'HDFCBANK',
  statementLayout: 'banking',
  sharesOutstandingCrore: 765,
  quarterlyProfitLoss: [
    { sales: 88420, expenses: 25060, otherIncome: 6420, interest: 42610, depreciation: 930, taxPercent: 24.7 },
    { sales: 89860, expenses: 25480, otherIncome: 6680, interest: 43290, depreciation: 948, taxPercent: 24.9 },
    { sales: 91180, expenses: 25840, otherIncome: 6810, interest: 43920, depreciation: 962, taxPercent: 24.8 },
    { sales: 92720, expenses: 26260, otherIncome: 7030, interest: 44500, depreciation: 980, taxPercent: 24.8 },
    { sales: 94360, expenses: 26720, otherIncome: 7280, interest: 45180, depreciation: 998, taxPercent: 25.0 },
  ],
  annualProfitLoss: [
    { sales: 135936, expenses: 40378, otherIncome: 15200, interest: 55980, depreciation: 1680, taxPercent: 25.4 },
    { sales: 161586, expenses: 47653, otherIncome: 18630, interest: 67917, depreciation: 1842, taxPercent: 25.3 },
    { sales: 283649, expenses: 79296, otherIncome: 21450, interest: 137194, depreciation: 3128, taxPercent: 24.6 },
    { sales: 335420, expenses: 96140, otherIncome: 24180, interest: 163280, depreciation: 3540, taxPercent: 24.9 },
    { sales: 362180, expenses: 102640, otherIncome: 26940, interest: 174320, depreciation: 3820, taxPercent: 24.8 },
  ],
  annualBalanceSheet: [
    { equityCapital: 555, reserves: 246772, borrowings: 1861835, otherLiabilities: 168420, fixedAssets: 6084, cwip: null, investments: 455536 },
    { equityCapital: 558, reserves: 288680, borrowings: 2185420, otherLiabilities: 192340, fixedAssets: 6812, cwip: null, investments: 517460 },
    { equityCapital: 760, reserves: 437440, borrowings: 3182640, otherLiabilities: 268520, fixedAssets: 11398, cwip: null, investments: 706520 },
    { equityCapital: 765, reserves: 502180, borrowings: 3428960, otherLiabilities: 289640, fixedAssets: 12240, cwip: null, investments: 762340 },
    { equityCapital: 765, reserves: 574320, borrowings: 3652180, otherLiabilities: 312480, fixedAssets: 13180, cwip: null, investments: 828460 },
  ],
  annualCashFlow: [
    { operatingProfitBeforeWorkingCapital: 62480, workingCapitalChange: -18240, taxPaid: -12180, cashFromInvesting: -8420, cashFromFinancing: -12640 },
    { operatingProfitBeforeWorkingCapital: 71340, workingCapitalChange: -142860, taxPaid: -14320, cashFromInvesting: -9840, cashFromFinancing: 118420 },
    { operatingProfitBeforeWorkingCapital: 98620, workingCapitalChange: -186420, taxPaid: -18240, cashFromInvesting: -14280, cashFromFinancing: 142860 },
    { operatingProfitBeforeWorkingCapital: 112480, workingCapitalChange: -78620, taxPaid: -21340, cashFromInvesting: -16420, cashFromFinancing: 24680 },
    { operatingProfitBeforeWorkingCapital: 126340, workingCapitalChange: -92180, taxPaid: -23860, cashFromInvesting: -18240, cashFromFinancing: 32460 },
  ],
  annualSegments: {
    leading: [
      { id: 'retail-banking', name: 'Retail Banking', sharePercent: [50.8, 51.4, 52.6, 52.9, 53.2] },
      { id: 'wholesale-banking', name: 'Wholesale Banking', sharePercent: [29.6, 29.1, 28.2, 27.8, 27.4] },
      { id: 'treasury', name: 'Treasury', sharePercent: [13.4, 13.2, 13.0, 13.1, 13.3] },
    ],
    balancing: { id: 'other-banking', name: 'Other Banking Operations' },
  },
}

const INFOSYS: CompanyInput = {
  companyId: 'INFY',
  statementLayout: 'standard',
  sharesOutstandingCrore: 415,
  quarterlyProfitLoss: [
    { sales: 42480, expenses: 33268, otherIncome: 1042, interest: 100, depreciation: 1108, taxPercent: 26.7 },
    { sales: 43260, expenses: 33884, otherIncome: 1078, interest: 102, depreciation: 1122, taxPercent: 26.5 },
    { sales: 43920, expenses: 34386, otherIncome: 1096, interest: 104, depreciation: 1140, taxPercent: 26.8 },
    { sales: 44660, expenses: 34960, otherIncome: 1144, interest: 106, depreciation: 1150, taxPercent: 26.4 },
    { sales: 45680, expenses: 35742, otherIncome: 1188, interest: 108, depreciation: 1176, taxPercent: 26.9 },
  ],
  annualProfitLoss: [
    { sales: 121641, expenses: 92964, otherIncome: 2295, interest: 200, depreciation: 3271, taxPercent: 26.5 },
    { sales: 146767, expenses: 115206, otherIncome: 2701, interest: 284, depreciation: 3969, taxPercent: 26.9 },
    { sales: 153670, expenses: 119795, otherIncome: 3411, interest: 470, depreciation: 4225, taxPercent: 27.4 },
    { sales: 162990, expenses: 128104, otherIncome: 4021, interest: 396, depreciation: 4318, taxPercent: 26.9 },
    { sales: 174320, expenses: 136498, otherIncome: 4360, interest: 412, depreciation: 4520, taxPercent: 26.6 },
  ],
  annualBalanceSheet: [
    { equityCapital: 2098, reserves: 75350, borrowings: 6975, otherLiabilities: 24180, fixedAssets: 13146, cwip: 1024, investments: 12569 },
    { equityCapital: 2071, reserves: 73280, borrowings: 7644, otherLiabilities: 26840, fixedAssets: 13521, cwip: 1180, investments: 13480 },
    { equityCapital: 2071, reserves: 84318, borrowings: 8098, otherLiabilities: 28560, fixedAssets: 13872, cwip: 862, investments: 14920 },
    { equityCapital: 2074, reserves: 91240, borrowings: 8320, otherLiabilities: 30180, fixedAssets: 14210, cwip: 940, investments: 16340 },
    { equityCapital: 2074, reserves: 98620, borrowings: 8560, otherLiabilities: 32140, fixedAssets: 14680, cwip: 1080, investments: 18120 },
  ],
  annualCashFlow: [
    { operatingProfitBeforeWorkingCapital: 29840, workingCapitalChange: -2680, taxPaid: -6420, cashFromInvesting: -3180, cashFromFinancing: -16240 },
    { operatingProfitBeforeWorkingCapital: 32460, workingCapitalChange: -3420, taxPaid: -6980, cashFromInvesting: 1240, cashFromFinancing: -22480 },
    { operatingProfitBeforeWorkingCapital: 35180, workingCapitalChange: -1860, taxPaid: -7620, cashFromInvesting: -2140, cashFromFinancing: -22860 },
    { operatingProfitBeforeWorkingCapital: 36940, workingCapitalChange: -2240, taxPaid: -7840, cashFromInvesting: -3620, cashFromFinancing: -21480 },
    { operatingProfitBeforeWorkingCapital: 39820, workingCapitalChange: -1980, taxPaid: -8360, cashFromInvesting: -4180, cashFromFinancing: -24120 },
  ],
  annualSegments: {
    leading: [
      { id: 'financial-services', name: 'Financial Services', sharePercent: [29.4, 28.8, 28.1, 27.9, 27.8] },
      { id: 'retail-cpg', name: 'Retail & Consumer Packaged Goods', sharePercent: [14.6, 14.4, 14.3, 14.2, 14.2] },
      { id: 'communication', name: 'Communication', sharePercent: [12.4, 12.1, 11.8, 11.7, 11.6] },
    ],
    balancing: { id: 'manufacturing-other', name: 'Manufacturing, Energy & Others' },
  },
}

const HINDUSTAN_UNILEVER: CompanyInput = {
  companyId: 'HINDUNILVR',
  statementLayout: 'standard',
  sharesOutstandingCrore: 235,
  quarterlyProfitLoss: [
    { sales: 16480, expenses: 12578, otherIncome: 214, interest: 94, depreciation: 320, taxPercent: 25.4 },
    { sales: 16820, expenses: 12826, otherIncome: 220, interest: 96, depreciation: 326, taxPercent: 25.2 },
    { sales: 17120, expenses: 13048, otherIncome: 226, interest: 97, depreciation: 330, taxPercent: 25.5 },
    { sales: 17060, expenses: 12986, otherIncome: 230, interest: 99, depreciation: 334, taxPercent: 25.1 },
    { sales: 17640, expenses: 13418, otherIncome: 238, interest: 98, depreciation: 342, taxPercent: 25.3 },
  ],
  annualProfitLoss: [
    { sales: 52446, expenses: 40108, otherIncome: 555, interest: 240, depreciation: 1061, taxPercent: 25.6 },
    { sales: 60580, expenses: 46613, otherIncome: 623, interest: 320, depreciation: 1156, taxPercent: 25.7 },
    { sales: 62707, expenses: 47934, otherIncome: 743, interest: 358, depreciation: 1200, taxPercent: 25.6 },
    { sales: 63121, expenses: 48284, otherIncome: 812, interest: 372, depreciation: 1246, taxPercent: 25.4 },
    { sales: 67480, expenses: 51438, otherIncome: 890, interest: 386, depreciation: 1310, taxPercent: 25.3 },
  ],
  annualBalanceSheet: [
    { equityCapital: 235, reserves: 48212, borrowings: 1225, otherLiabilities: 12480, fixedAssets: 9448, cwip: 620, investments: 3180 },
    { equityCapital: 235, reserves: 50575, borrowings: 1290, otherLiabilities: 13120, fixedAssets: 9612, cwip: 542, investments: 3420 },
    { equityCapital: 235, reserves: 51028, borrowings: 1362, otherLiabilities: 13860, fixedAssets: 9840, cwip: 480, investments: 3680 },
    { equityCapital: 235, reserves: 52180, borrowings: 1418, otherLiabilities: 14520, fixedAssets: 10120, cwip: 512, investments: 3940 },
    { equityCapital: 235, reserves: 54620, borrowings: 1480, otherLiabilities: 15240, fixedAssets: 10460, cwip: 560, investments: 4260 },
  ],
  annualCashFlow: [
    { operatingProfitBeforeWorkingCapital: 12680, workingCapitalChange: -420, taxPaid: -2840, cashFromInvesting: -1240, cashFromFinancing: -8060 },
    { operatingProfitBeforeWorkingCapital: 14120, workingCapitalChange: -680, taxPaid: -3120, cashFromInvesting: -980, cashFromFinancing: -9180 },
    { operatingProfitBeforeWorkingCapital: 14980, workingCapitalChange: -520, taxPaid: -3280, cashFromInvesting: -1420, cashFromFinancing: -9620 },
    { operatingProfitBeforeWorkingCapital: 15240, workingCapitalChange: -610, taxPaid: -3340, cashFromInvesting: -1180, cashFromFinancing: -9940 },
    { operatingProfitBeforeWorkingCapital: 16480, workingCapitalChange: -480, taxPaid: -3620, cashFromInvesting: -1560, cashFromFinancing: -10620 },
  ],
  annualSegments: {
    leading: [
      { id: 'home-care', name: 'Home Care', sharePercent: [30.8, 31.6, 31.2, 30.9, 30.6] },
      { id: 'beauty-wellbeing', name: 'Beauty & Wellbeing', sharePercent: [21.4, 21.2, 21.6, 21.9, 22.2] },
      { id: 'personal-care', name: 'Personal Care', sharePercent: [14.2, 13.9, 13.8, 13.7, 13.6] },
    ],
    balancing: { id: 'foods-refreshment', name: 'Foods & Refreshment' },
  },
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

const COMPANY_INPUTS: readonly CompanyInput[] = [
  RELIANCE,
  TCS,
  HDFC_BANK,
  INFOSYS,
  HINDUSTAN_UNILEVER,
]

/** Authored mock financials, keyed by `MockCompany.id`. */
export const COMPANY_FINANCIALS: Readonly<Record<string, CompanyFinancials>> =
  Object.fromEntries(COMPANY_INPUTS.map((input) => [input.companyId, buildFinancials(input)]))

/**
 * A company's financials, real if we have scraped them, mock otherwise.
 *
 * The decision is per company and made here, in the one accessor every
 * financials view already reads through: a valid `data/<SYMBOL>.json` wins;
 * absent or malformed, the authored mock is used; unknown company → `null`.
 * `DataSource.provider` on the result records which it was (`'screener'` vs
 * `'mock'`), so the UI can be honest about it without a second lookup.
 */
export function getCompanyFinancials(companyId: string): CompanyFinancials | null {
  return getScrapedFinancials(companyId) ?? COMPANY_FINANCIALS[companyId] ?? null
}

/** The provenance of whatever `getCompanyFinancials` would return, for the UI. */
export function getCompanyDataSource(companyId: string): DataSource | null {
  return getCompanyFinancials(companyId)?.source ?? null
}
