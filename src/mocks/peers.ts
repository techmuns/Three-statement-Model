/**
 * Peer groups for the five tracked companies.
 *
 * Each group is a sector cohort with four external comparables. Their KPI
 * values are carried directly rather than derived, because we hold no
 * statements for them — the same situation the real pipeline will be in, where
 * peer KPIs come from Screener's sector screen rather than from a full scrape
 * of every peer.
 *
 * The tracked members of a group are deliberately not repeated in `peers`;
 * their values are derived from their own statements in `kpis.ts`, and
 * duplicating them here would let the two drift apart.
 */

import type { KpiId } from '@/types/kpi'
import type { PeerCompany, PeerGroup, PeerGroupId, PeerKpiSnapshot } from '@/types/peers'

/** Authoring shorthand: values in `KPI_ORDER` order. */
const KPI_ORDER: readonly KpiId[] = [
  'revenue-growth',
  'operating-margin',
  'net-profit-margin',
  'return-on-equity',
  'return-on-capital-employed',
  'debt-to-equity',
]

function peer(
  id: string,
  name: string,
  ticker: string,
  marketCapCrore: number,
  values: readonly number[],
): PeerCompany {
  const kpis: PeerKpiSnapshot[] = KPI_ORDER.map((kpiId, index) => ({
    kpiId,
    value: values[index],
  }))

  return { id, name, ticker, marketCapCrore, kpis }
}

export const PEER_GROUPS: readonly PeerGroup[] = [
  {
    id: 'it-services',
    label: 'IT Services',
    sector: 'IT Services',
    memberCompanyIds: ['TCS', 'INFY'],
    peers: [
      //                                              growth  OPM   NPM   ROE   ROCE  D/E
      peer('hcl-technologies', 'HCL Technologies', 'HCLTC', 468200, [8.4, 22.1, 14.8, 24.5, 33.8, 0.08]),
      peer('wipro', 'Wipro', 'WIPRO', 262400, [2.1, 17.4, 12.9, 15.2, 19.4, 0.24]),
      peer('tech-mahindra', 'Tech Mahindra', 'TECHM', 148600, [4.6, 12.8, 8.4, 12.1, 15.4, 0.16]),
      peer('ltimindtree', 'LTIMindtree', 'LTIMT', 154900, [9.8, 16.2, 12.1, 21.4, 31.2, 0.06]),
    ],
  },
  {
    id: 'private-banks',
    label: 'Private Sector Banks',
    sector: 'Private Sector Bank',
    memberCompanyIds: ['HDFCBANK'],
    peers: [
      peer('icici-bank', 'ICICI Bank', 'ICICB', 1024600, [14.2, 24.8, 22.4, 17.8, 7.2, 6.8]),
      peer('axis-bank', 'Axis Bank', 'AXISB', 372800, [11.6, 21.4, 18.2, 16.4, 6.8, 7.4]),
      peer('kotak-mahindra-bank', 'Kotak Mahindra Bank', 'KOTKB', 428300, [12.8, 26.2, 24.1, 15.2, 6.4, 5.9]),
      peer('indusind-bank', 'IndusInd Bank', 'INDSB', 76400, [8.4, 19.6, 13.8, 9.8, 6.1, 7.9]),
    ],
  },
  {
    id: 'fmcg',
    label: 'FMCG',
    sector: 'FMCG',
    memberCompanyIds: ['HINDUNILVR'],
    peers: [
      peer('itc', 'ITC', 'ITCLD', 542700, [7.2, 33.8, 25.4, 28.4, 36.2, 0.01]),
      peer('nestle-india', 'Nestlé India', 'NESTI', 218400, [5.8, 23.4, 15.9, 82.6, 108.4, 0.04]),
      peer('britannia-industries', 'Britannia Industries', 'BRITA', 138900, [8.6, 18.2, 12.4, 54.2, 62.8, 0.42]),
      peer('dabur-india', 'Dabur India', 'DABUR', 91200, [6.4, 19.1, 13.6, 18.9, 22.4, 0.11]),
    ],
  },
  {
    id: 'oil-gas-energy',
    label: 'Oil, Gas & Energy',
    sector: 'Oil, Gas & Consumer',
    memberCompanyIds: ['RELIANCE'],
    peers: [
      peer('ongc', 'Oil & Natural Gas Corporation', 'ONGCO', 312600, [3.4, 24.6, 8.1, 13.2, 16.8, 0.42]),
      peer('indian-oil', 'Indian Oil Corporation', 'IOCLD', 204800, [2.8, 6.4, 2.6, 9.4, 11.2, 0.86]),
      peer('bpcl', 'Bharat Petroleum', 'BPCLD', 142300, [4.1, 7.8, 3.4, 18.6, 21.4, 0.68]),
      peer('gail-india', 'GAIL (India)', 'GAILI', 128700, [6.2, 11.4, 6.8, 14.8, 17.6, 0.31]),
    ],
  },
]

export function findPeerGroup(id: PeerGroupId): PeerGroup | null {
  return PEER_GROUPS.find((group) => group.id === id) ?? null
}

/** The group a tracked company is compared against. */
export function getPeerGroupForCompany(companyId: string): PeerGroup | null {
  return PEER_GROUPS.find((group) => group.memberCompanyIds.includes(companyId)) ?? null
}

/**
 * Other tracked companies sharing a peer group — TCS and Infosys, today.
 *
 * Kept separate from `peers` because these have full statements behind them,
 * so a comparison row for them can be derived and drilled into.
 */
export function getTrackedSiblings(companyId: string): readonly string[] {
  const group = getPeerGroupForCompany(companyId)
  if (!group) return []
  return group.memberCompanyIds.filter((memberId) => memberId !== companyId)
}
