import { useRef } from 'react'
import type { NavItem } from '@/config/navigation'
import { cn } from '@/lib/cn'

export type TabsVariant = 'primary' | 'sub'

export interface TabsProps<Id extends string> {
  /** Distinguishes this tablist's generated ids from any other on the page. */
  idPrefix: string
  label: string
  items: readonly NavItem<Id>[]
  value: Id
  onChange: (id: Id) => void
  variant?: TabsVariant
}

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`
export const tabPanelId = (prefix: string, id: string) => `${prefix}-panel-${id}`

/**
 * Tablist following the WAI-ARIA tabs pattern with manual activation.
 *
 * Roving tabindex: only the selected tab is in the tab sequence, so Tab moves
 * past the whole tablist into the panel. Left/Right (with wraparound), Home and
 * End move focus between tabs; Enter or Space selects the focused one. Manual
 * rather than automatic activation, because a later phase will fetch on tab
 * change and arrowing across would fire every request in between.
 */
export function Tabs<Id extends string>({
  idPrefix,
  label,
  items,
  value,
  onChange,
  variant = 'primary',
}: TabsProps<Id>) {
  const tabRefs = useRef(new Map<Id, HTMLButtonElement>())

  const focusTab = (id: Id) => tabRefs.current.get(id)?.focus()

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1
    let nextIndex: number | null = null

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = index === last ? 0 : index + 1
        break
      case 'ArrowLeft':
        nextIndex = index === 0 ? last : index - 1
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = last
        break
      default:
        return
    }

    event.preventDefault()
    focusTab(items[nextIndex].id)
  }

  const isPrimary = variant === 'primary'

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={cn(
        'flex items-center overflow-x-auto',
        isPrimary
          ? // `py-1` keeps the focus ring inside the scroll container, which
            // would otherwise clip its top edge.
            'gap-1 py-1'
          : // `w-fit` so the pill track hugs its tabs instead of stretching
            // across the full content width.
            'w-fit max-w-full gap-1 rounded-control border border-line-hairline bg-surface-sunken p-1',
      )}
    >
      {items.map((item, index) => {
        const selected = item.id === value

        return (
          <button
            key={item.id}
            ref={(node) => {
              if (node) tabRefs.current.set(item.id, node)
              else tabRefs.current.delete(item.id)
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, item.id)}
            aria-selected={selected}
            aria-controls={tabPanelId(idPrefix, item.id)}
            title={item.description}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'relative shrink-0 cursor-pointer whitespace-nowrap font-semibold transition-colors duration-200',
              isPrimary
                ? 'px-1 pt-2 pb-3 text-title'
                : 'rounded-[0.375rem] px-3 py-1.5 text-label',
              isPrimary && (selected ? 'text-brand-700' : 'text-ink-muted hover:text-ink-primary'),
              !isPrimary &&
                (selected
                  ? 'bg-surface-card text-brand-700 shadow-card'
                  : 'text-ink-muted hover:text-ink-primary'),
            )}
          >
            <span className={isPrimary ? 'px-2' : undefined}>{item.label}</span>
            {isPrimary && (
              // The active indicator is a gradient rule, not a colour change
              // alone — selection stays legible without relying on hue.
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-x-0 bottom-0 h-0.5 rounded-full transition-opacity duration-200',
                  selected ? 'bg-gradient-accent-rule opacity-100' : 'opacity-0',
                )}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

/** The panel a tablist controls. Focusable so keyboard users land inside it. */
export function TabPanel<Id extends string>({
  idPrefix,
  id,
  children,
}: {
  idPrefix: string
  id: Id
  children: React.ReactNode
}) {
  return (
    <div
      role="tabpanel"
      id={tabPanelId(idPrefix, id)}
      aria-labelledby={tabId(idPrefix, id)}
      tabIndex={0}
      className="rounded-card outline-offset-4"
    >
      {children}
    </div>
  )
}
