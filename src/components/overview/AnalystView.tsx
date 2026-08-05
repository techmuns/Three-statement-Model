import { WidgetCard } from '@/components/widgets/WidgetCard'
import type { AnalystPoint, AnalystSummary } from '@/lib/analystSummary'

function PointList({
  points,
  tone,
  emptyNote,
}: {
  points: readonly AnalystPoint[]
  tone: 'good' | 'warning'
  emptyNote: string
}) {
  const dotClass = tone === 'good' ? 'bg-status-good' : 'bg-status-warning'

  if (points.length === 0) {
    return <p className="text-caption text-ink-subtle">{emptyNote}</p>
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {points.map((point) => (
        <li key={point.kpiId} className="flex gap-2.5">
          <span aria-hidden="true" className={`mt-1.5 size-1.5 shrink-0 rounded-full ${dotClass}`} />
          <span className="text-caption leading-relaxed text-ink-secondary">{point.text}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Strengths and watch items, each a templated, data-supported statement from
 * the real KPI-vs-peer and KPI-vs-history evidence. When neither side of the
 * data supports a point, the column says so rather than inventing prose.
 */
export function AnalystView({ summary }: { summary: AnalystSummary }) {
  return (
    <WidgetCard
      title="Analyst view"
      subtitle="Templated from real KPI, peer and trend data"
      footnote="Every point cites the figures behind it — no point is made where the data does not support one."
      wide
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h4 className="mb-2.5 text-caption font-semibold tracking-wide text-status-good uppercase">
            Strengths
          </h4>
          <PointList
            points={summary.strengths}
            tone="good"
            emptyNote="No clear strengths stand out from the peer and trend data yet."
          />
        </div>
        <div>
          <h4 className="mb-2.5 text-caption font-semibold tracking-wide text-status-warning uppercase">
            Watch items
          </h4>
          <PointList
            points={summary.watchItems}
            tone="warning"
            emptyNote="Nothing flagged from the peer and trend data yet."
          />
        </div>
      </div>
    </WidgetCard>
  )
}
