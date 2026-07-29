import { WidgetCard } from '@/components/widgets/WidgetCard'
import { WidgetGrid } from '@/components/widgets/WidgetGrid'
import { WidgetEmptyState } from '@/components/widgets/WidgetEmptyState'
import { WidgetSkeleton } from '@/components/widgets/WidgetSkeleton'
import { StatList } from '@/components/widgets/StatTile'
import type { WidgetState } from '@/components/widgets/widgetState'
import type { PlaceholderWidget } from '@/mocks/placeholders'

/**
 * Renders a set of placeholder widgets in the standard grid.
 *
 * The `state` prop drives every card at once — that is a scaffold for this
 * phase. Once data loads per widget, each card owns its own state and this
 * component takes a per-widget status instead.
 */
export function WidgetDeck({
  widgets,
  state = 'ready',
}: {
  widgets: PlaceholderWidget[]
  state?: WidgetState
}) {
  return (
    <WidgetGrid>
      {widgets.map((widget) => (
        <WidgetCard
          key={widget.id}
          title={widget.title}
          subtitle={widget.subtitle}
          badge={widget.badge}
          footnote={state === 'ready' ? widget.footnote : undefined}
          wide={widget.wide}
        >
          {state === 'loading' ? (
            <WidgetSkeleton
              rows={Math.max(widget.stats.length, 2)}
              label={`Loading ${widget.title}`}
            />
          ) : state === 'empty' || widget.empty ? (
            <WidgetEmptyState
              message={widget.empty?.message ?? 'Nothing to show yet'}
              hint={
                widget.empty?.hint ??
                'Once a data source is connected this card fills in automatically.'
              }
            />
          ) : (
            <StatList stats={widget.stats} />
          )}
        </WidgetCard>
      ))}
    </WidgetGrid>
  )
}
