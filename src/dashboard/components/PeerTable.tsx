/**
 * Peer comparison: the subject company beside its sector comparables.
 *
 * The subject's KPIs are derived from statements we hold; peers are "carried"
 * from Screener's peer table, which exposes only a couple of columns — so most
 * peer KPI cells are honestly blank rather than guessed. A blank means "not
 * available from the peer source", never zero.
 */

import type { CSSProperties } from 'react'
import { KPI_DEFINITIONS } from '@/config/kpis'
import { formatCrore, formatPercent, formatRatio } from '@/lib/format'
import type { KpiDefinition, KpiId } from '@/types/kpi'
import type { PeerGroup } from '@/types/peers'
import type { Reported } from '@/types/common'
import { T } from '../ui/tokens'

function fmt(value: Reported<number>, def: KpiDefinition): string {
  if (value === null) return '—'
  return def.unit === 'percent' ? formatPercent(value, def.precision) : formatRatio(value, def.precision)
}

interface Row {
  key: string
  name: string
  isSubject: boolean
  marketCap: Reported<number>
  values: Map<KpiId, Reported<number>>
}

export function PeerTable({
  subjectName,
  subjectKpis,
  group,
}: {
  subjectName: string
  subjectKpis: Map<KpiId, Reported<number>>
  group: PeerGroup
}) {
  const rows: Row[] = [
    { key: '__subject', name: subjectName, isSubject: true, marketCap: null, values: subjectKpis },
    ...group.peers.map((peer) => ({
      key: peer.id,
      name: peer.name,
      isSubject: false,
      marketCap: peer.marketCapCrore ?? null,
      values: new Map(peer.kpis.map((k) => [k.kpiId, k.value] as const)),
    })),
  ]

  const th: CSSProperties = {
    padding: '8px 12px',
    fontSize: 11,
    fontWeight: 600,
    color: T.inkMuted,
    textAlign: 'right',
    whiteSpace: 'nowrap',
    borderBottom: `1px solid ${T.hairline}`,
    background: T.cardHeaderBg,
    position: 'sticky',
    top: 0,
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          <th scope="col" style={{ ...th, textAlign: 'left', left: 0, zIndex: 2 }}>
            Company
          </th>
          <th scope="col" style={th}>
            Mkt Cap (₹cr)
          </th>
          {KPI_DEFINITIONS.map((def) => (
            <th scope="col" key={def.id} style={th} title={def.label}>
              {def.shortLabel}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const cell: CSSProperties = {
            padding: '7px 12px',
            textAlign: 'right',
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
            borderBottom: `1px solid ${T.borderDefault}`,
            color: T.inkSecondary,
            background: row.isSubject ? 'rgba(238,242,255,0.4)' : undefined,
          }
          return (
            <tr key={row.key}>
              <th
                scope="row"
                style={{
                  ...cell,
                  textAlign: 'left',
                  position: 'sticky',
                  left: 0,
                  color: T.ink,
                  fontWeight: row.isSubject ? 700 : 500,
                  background: row.isSubject ? '#eef2ff' : T.cardBodyBg,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {row.name}
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      padding: '1px 6px',
                      borderRadius: 5,
                      color: row.isSubject ? T.primaryText : T.inkHint,
                      background: row.isSubject ? T.primaryLight : '#f3f4f6',
                    }}
                  >
                    {row.isSubject ? 'This co.' : 'carried'}
                  </span>
                </span>
              </th>
              <td style={cell}>{formatCrore(row.marketCap)}</td>
              {KPI_DEFINITIONS.map((def) => (
                <td key={def.id} style={cell}>
                  {fmt(row.values.get(def.id) ?? null, def)}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
