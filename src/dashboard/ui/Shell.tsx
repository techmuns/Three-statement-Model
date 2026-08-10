/**
 * The mandatory 3-zone iframe shell: sticky header (48px), the single scrolling
 * main (Zone 2, the visual-export capture target), and an optional thin footer.
 * The page itself never scrolls — only Zone 2 does.
 */

import type { ReactNode } from 'react'
import { FONT_STACK, T } from './tokens'

export function Shell({
  header,
  footer,
  children,
}: {
  header: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: T.pageBg,
        fontFamily: FONT_STACK,
        color: T.ink,
      }}
    >
      {header}
      <main
        id="dashboard-main"
        data-dashboard-capture-root="true"
        style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}
      >
        {children}
      </main>
      {footer}
    </div>
  )
}

/** Zone 3: a thin source/freshness strip. */
export function Footer({ children }: { children: ReactNode }) {
  return (
    <footer
      style={{
        flexShrink: 0,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 24px',
        borderTop: `1px solid ${T.hairline}`,
        background: T.headerBar,
        backdropFilter: 'blur(8px)',
        fontSize: 12,
        color: T.inkHint,
      }}
    >
      {children}
    </footer>
  )
}
