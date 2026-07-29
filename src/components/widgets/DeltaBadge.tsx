import type { StatusTone } from '@/theme/tokens'
import { cn } from '@/lib/cn'

const toneClass: Record<StatusTone, string> = {
  good: 'bg-status-good-soft text-status-good',
  warning: 'bg-status-warning-soft text-status-warning',
  critical: 'bg-status-critical-soft text-status-critical',
  neutral: 'bg-status-neutral-soft text-status-neutral',
}

/**
 * Direction comes from the sign in the label, tone from the caller — they are
 * not the same thing. A falling P/E is a decrease (▼) and good news (green);
 * deriving the arrow from the tone would point it the wrong way.
 */
function directionGlyph(label: string): string {
  const first = label.trimStart().charAt(0)
  if (first === '+') return '▲'
  if (first === '-' || first === '−') return '▼'
  return '•'
}

/**
 * Period-on-period change pill.
 *
 * The glyph and the label text both carry the meaning, so it survives for
 * colour-blind readers and in forced-colours mode where the tone is lost.
 */
export function DeltaBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-micro font-semibold tracking-normal',
        toneClass[tone],
      )}
    >
      <span aria-hidden="true">{directionGlyph(label)}</span>
      {label}
    </span>
  )
}
