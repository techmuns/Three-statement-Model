/**
 * Peer-group access.
 *
 * Sector cohorts are scraped into `data/peer-groups/<id>.json`. A company maps
 * to the group whose `memberCompanyIds` include it. Screener's peer table only
 * exposes a couple of columns (market cap, ROCE), so carried peers hold only
 * those — the widgets are honest about the rest being unavailable.
 */

import type { PeerGroup } from '@/types/peers'

const files = import.meta.glob<PeerGroup>('/data/peer-groups/*.json', {
  eager: true,
  import: 'default',
})

const GROUPS: readonly PeerGroup[] = Object.values(files)

/** The peer group a company belongs to, or `null` if none covers it yet. */
export function peerGroupFor(companyId: string): PeerGroup | null {
  const symbol = companyId.trim().toUpperCase()
  return GROUPS.find((g) => g.memberCompanyIds.some((id) => id.toUpperCase() === symbol)) ?? null
}
