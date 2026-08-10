/**
 * The mandatory widget states (Munshot ui-standards): loading shimmer,
 * empty, unavailable (honest "not reported"), waiting-for-session, and error.
 * Every one is centred in the widget body with a minimum height.
 */

import type { CSSProperties } from 'react'
import { T } from './tokens'

const centre: CSSProperties = {
  minHeight: 160,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: 20,
  textAlign: 'center',
}

const message: CSSProperties = { fontSize: 13, fontWeight: 600, color: T.inkSecondary }
const hintStyle: CSSProperties = { fontSize: 12, color: T.inkHint, maxWidth: 320, lineHeight: 1.4 }

function Marker({ glyph, bg, color }: { glyph: string; bg: string; color: string }) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        color,
        fontSize: 20,
        lineHeight: 1,
      }}
      aria-hidden
    >
      {glyph}
    </div>
  )
}

/** Shimmer skeleton. `rows` bars sized to hint at the final table shape. */
export function LoadingState({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="dash-shimmer" style={{ height: 14, width: `${90 - i * 6}%` }} />
      ))}
    </div>
  )
}

export function EmptyState({ message: msg, hint }: { message: string; hint?: string }) {
  return (
    <div style={centre}>
      <Marker glyph="◎" bg={T.primaryLight} color={T.primary} />
      <div style={message}>{msg}</div>
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  )
}

/** Honest "the company does not report this" — distinct from an error. */
export function UnavailableState({ note, hint }: { note: string; hint?: string }) {
  return (
    <div style={centre}>
      <Marker glyph="–" bg="#f3f4f6" color={T.inkMuted} />
      <div style={message}>{note}</div>
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  )
}

export function WaitingForSession() {
  return (
    <div style={{ padding: 16, textAlign: 'center', color: T.inkHint, fontSize: 13 }}>
      Waiting for session…
    </div>
  )
}

export function ErrorState({ hint }: { hint?: string }) {
  return (
    <div style={centre}>
      <Marker glyph="!" bg={T.errorBg} color={T.errorText} />
      <div style={{ ...message, color: T.errorText }}>Couldn’t load this widget</div>
      <div style={hintStyle}>{hint ?? 'Please try again later.'}</div>
    </div>
  )
}
