/**
 * Peer comparison table: the subject beside its comparables, all six KPIs.
 *
 * Derived rows carry KPIs computed from that peer's own scraped statements;
 * carried rows show only what Screener's peer snapshot held; absent rows are
 * peers we haven't scraped yet. A blank cell means "not available from that
 * peer's data", never zero.
 */

import type { CSSProperties } from 'react'
import { KPI_DEFINITIONS } from '@/config/kpis'
import { formatCrore, formatPercent, formatRatio } from '@/lib/format'
import type { KpiDefinition } from '@/types/kpi'
import type { Reported } from '@/types/common'
import type { PeerRow } from '../data/peerKpis'
import { T } from '../ui/tokens'

function fmt(value: Reported<number>, def: KpiDefinition): string {
  if (value === null || value === undefined) return '—'
  return def.unit === 'percent' ? formatPercent(value, def.precision) : formatRatio(value, def.precision)
}

const ORIGIN_CHIP: Record<PeerRow['origin'], { label: string; bg: string; color: string }> = {
  derived: { label: 'peer', bg: '#f0fdf4', color: '#16a34a' },
  carried: { label: 'carried', bg: '#f3f4f6', color: '#6b7280' },
  absent: { label: 'not analyzed', bg: '#fffbeb', color: '#d97706' },
}

export function PeerTable({ rows }: { rows: readonly PeerRow[] }) {
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
            color: row.origin === 'absent' ? T.inkHint : T.inkSecondary,
            background: row.isSubject ? 'rgba(238,242,255,0.4)' : undefined,
          }
          const chip = row.isSubject
            ? { label: 'This co.', bg: T.primaryLight, color: T.primaryText }
            : ORIGIN_CHIP[row.origin]
          return (
            <tr key={row.symbol}>
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      padding: '1px 6px',
                      borderRadius: 5,
                      color: chip.color,
                      background: chip.bg,
                      flexShrink: 0,
                    }}
                  >
                    {chip.label}
                  </span>
                </span>
              </th>
              <td style={cell}>{formatCrore(row.marketCap)}</td>
              {KPI_DEFINITIONS.map((def) => (
                <td key={def.id} style={cell}>
                  {fmt(row.kpis.get(def.id) ?? null, def)}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
