/**
 * Sector peer-group definitions for the tracked companies.
 *
 * These map our five companies onto the four `PeerGroupId` cohorts the schema
 * defines. `memberCompanyIds` are the tracked companies that belong to a group
 * (compared derived-vs-derived); the carried peers are whatever Screener's peer
 * table lists that are *not* one of our tracked companies. Kept here rather than
 * imported from the frontend so the scraper stays free of `src/`.
 */

import type { PeerGroupId } from '../../src/types/peers'

export interface PeerGroupConfig {
  readonly id: PeerGroupId
  readonly label: string
  /** Matches the `sector` string on the tracked companies in this group. */
  readonly sector: string
  /** Tracked `companyId`s that use this group. */
  readonly memberCompanyIds: readonly string[]
}

export const PEER_GROUP_CONFIG: readonly PeerGroupConfig[] = [
  {
    id: 'it-services',
    label: 'IT Services',
    sector: 'IT Services',
    memberCompanyIds: ['TCS', 'INFY'],
  },
  {
    id: 'private-banks',
    label: 'Private Sector Banks',
    sector: 'Private Sector Bank',
    memberCompanyIds: ['HDFCBANK'],
  },
  { id: 'fmcg', label: 'FMCG', sector: 'FMCG', memberCompanyIds: ['HINDUNILVR'] },
  {
    id: 'oil-gas-energy',
    label: 'Oil, Gas & Energy',
    sector: 'Oil, Gas & Consumer',
    memberCompanyIds: ['RELIANCE'],
  },
]

/** The group a tracked company belongs to, or undefined if it maps to none. */
export function peerGroupForCompany(companyId: string): PeerGroupConfig | undefined {
  return PEER_GROUP_CONFIG.find((group) => group.memberCompanyIds.includes(companyId))
}
