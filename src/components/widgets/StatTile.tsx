import type { StatusTone } from '@/theme/tokens'
import { DeltaBadge } from './DeltaBadge'

export interface StatTileProps {
  label: string
  value: string
  delta?: { label: string; tone: StatusTone }
}

/**
 * A labelled figure. The building block of every non-chart widget body.
 *
 * Uses a description list so the label/value relationship is exposed to
 * assistive tech rather than implied by position.
 */
export function StatTile({ label, value, delta }: StatTileProps) {
  return (
    <div>
      <dt className="text-caption font-medium text-ink-muted">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-stat font-semibold text-ink-primary">{value}</span>
        {delta && <DeltaBadge label={delta.label} tone={delta.tone} />}
      </dd>
    </div>
  )
}

/** Stat tiles stacked inside a widget body. */
export function StatList({ stats }: { stats: StatTileProps[] }) {
  return (
    <dl className="flex flex-col gap-4">
      {stats.map((stat) => (
        <StatTile key={stat.label} {...stat} />
      ))}
    </dl>
  )
}
