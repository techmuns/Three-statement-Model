/**
 * The one card shell every data widget uses (Munshot ui-standards).
 * Header (title + subtitle + optional right slot) over a body. No nested cards.
 */

import { useState, type CSSProperties, type ReactNode } from 'react'
import { T } from './tokens'

export interface WidgetCardProps {
  title: string
  subtitle?: string
  /** Right-aligned header slot: a category badge, a control, a value. */
  right?: ReactNode
  /** Span two grid columns on wide layouts. */
  wide?: boolean
  /** Pad the body. Off for edge-to-edge tables. */
  padded?: boolean
  children: ReactNode
}

export function WidgetCard({ title, subtitle, right, wide, padded, children }: WidgetCardProps) {
  const [hover, setHover] = useState(false)

  const card: CSSProperties = {
    background: T.cardBg,
    border: `1px solid ${hover ? T.borderHover : T.borderDefault}`,
    borderRadius: 16,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    backdropFilter: 'blur(8px)',
    // Calm, static cards — no lift/translate on hover (that read as the widgets
    // "dancing" as the cursor moved across them). Just a gentle border on hover.
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    transition: 'border-color 120ms ease',
    gridColumn: wide ? 'span 2' : undefined,
    minWidth: 0,
  }

  return (
    <div
      style={card}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 16px',
          borderBottom: `1px solid ${T.borderDefault}`,
          background: T.cardHeaderBg,
          backdropFilter: 'blur(8px)',
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.ink }}>{title}</h3>
          {subtitle && (
            <p style={{ margin: '2px 0 0', fontSize: 11, color: T.inkHint, lineHeight: 1.3 }}>
              {subtitle}
            </p>
          )}
        </div>
        {right && <div style={{ flexShrink: 0 }}>{right}</div>}
      </div>
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'auto',
          background: T.cardBodyBg,
          padding: padded ? 16 : 0,
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** A small uppercase category badge for a widget header's right slot. */
export function CategoryBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '2px 8px',
        borderRadius: 6,
        border: '1px solid #fde68a',
        background: '#fffbeb',
        color: '#d97706',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
