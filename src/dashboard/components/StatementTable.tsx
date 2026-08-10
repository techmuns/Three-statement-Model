/**
 * The one statement table: line items down the left, periods across the top.
 * Reused by P&L, balance sheet and cash flow — only the row set changes.
 * Real `<th scope>` headers, so a screen reader announces each figure with its
 * row and column. Numbers are en-IN grouped; a not-reported cell is an em dash.
 */

import type { CSSProperties } from 'react'
import type { PeriodRef } from '@/types/period'
import type { Reported } from '@/types/common'
import { formatCrore, formatPercent, formatRatio, formatRupees } from '@/lib/format'
import { T } from '../ui/tokens'

export type ValueKind = 'crore' | 'percent' | 'rupees' | 'ratio'

export interface StatementRow<P> {
  label: string
  kind: ValueKind
  value: (period: P) => Reported<number>
  /** Bold subtotal / total line. */
  emphasis?: boolean
  /** Indented, muted sub-line (e.g. "of which: working-capital change"). */
  sub?: boolean
}

function render(value: Reported<number>, kind: ValueKind): string {
  switch (kind) {
    case 'crore':
      return formatCrore(value)
    case 'percent':
      return formatPercent(value)
    case 'rupees':
      return formatRupees(value)
    case 'ratio':
      return formatRatio(value)
  }
}

export function StatementTable<P extends { period: PeriodRef }>({
  periods,
  rows,
  unitLabel = '₹ crore',
}: {
  periods: readonly P[]
  rows: readonly StatementRow<P>[]
  unitLabel?: string
}) {
  const th: CSSProperties = {
    position: 'sticky',
    top: 0,
    background: T.cardHeaderBg,
    padding: '8px 14px',
    fontSize: 11,
    fontWeight: 600,
    color: T.inkMuted,
    textAlign: 'right',
    whiteSpace: 'nowrap',
    borderBottom: `1px solid ${T.hairline}`,
  }
  const labelHead: CSSProperties = {
    ...th,
    left: 0,
    zIndex: 2,
    textAlign: 'left',
    color: T.inkHint,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          <th scope="col" style={{ ...labelHead, zIndex: 3 }}>
            {unitLabel}
          </th>
          {periods.map((p) => (
            <th scope="col" key={p.period.id} style={th}>
              {p.period.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const cellBase: CSSProperties = {
            padding: row.sub ? '5px 14px' : '7px 14px',
            textAlign: 'right',
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
            borderBottom: `1px solid ${T.borderDefault}`,
            color: row.sub ? T.inkMuted : T.inkSecondary,
            fontWeight: row.emphasis ? 700 : 400,
            background: row.emphasis ? 'rgba(238,242,255,0.35)' : undefined,
          }
          return (
            <tr key={row.label}>
              <th
                scope="row"
                style={{
                  ...cellBase,
                  position: 'sticky',
                  left: 0,
                  textAlign: 'left',
                  paddingLeft: row.sub ? 26 : 14,
                  color: row.sub ? T.inkMuted : T.ink,
                  fontWeight: row.emphasis ? 700 : row.sub ? 400 : 500,
                  background: row.emphasis ? '#eef2ff' : T.cardBodyBg,
                  fontSize: row.sub ? 12 : 13,
                }}
              >
                {row.label}
              </th>
              {periods.map((p) => (
                <td key={p.period.id} style={cellBase}>
                  {render(row.value(p), row.kind)}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
