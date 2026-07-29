import { useId } from 'react'
import type { NavItem } from '@/config/navigation'

export interface SegmentedControlProps<Id extends string> {
  label: string
  items: readonly NavItem<Id>[]
  value: Id
  onChange: (id: Id) => void
  /** Render `label` beside the control instead of only for screen readers.
   * Use it wherever two segmented controls sit side by side. */
  showLabel?: boolean
}

/**
 * Segmented single-choice control.
 *
 * Built on native radio inputs inside a fieldset: arrow-key navigation, the
 * roving tab stop and the group semantics all come from the platform rather
 * than from hand-rolled key handling. The inputs are visually hidden but not
 * removed from the accessibility tree, so the focus ring lands on the visible
 * segment via `peer-focus-visible`.
 */
export function SegmentedControl<Id extends string>({
  label,
  items,
  value,
  onChange,
  showLabel = false,
}: SegmentedControlProps<Id>) {
  const name = useId()

  return (
    <fieldset className="flex min-w-0 items-center gap-2">
      {/* The legend names the group for assistive tech in both cases; the
          visible copy is decorative and hidden from the a11y tree so the
          label is not announced twice. */}
      <legend className="sr-only">{label}</legend>
      {showLabel && (
        <span aria-hidden="true" className="text-caption font-medium text-ink-subtle">
          {label}
        </span>
      )}
      <div className="inline-flex rounded-control border border-line-hairline bg-surface-sunken p-1">
        {items.map((item) => {
          const checked = item.id === value

          return (
            <label
              key={item.id}
              className="relative cursor-pointer whitespace-nowrap"
              data-checked={checked || undefined}
            >
              <input
                type="radio"
                name={name}
                value={item.id}
                checked={checked}
                onChange={() => onChange(item.id)}
                className="peer sr-only"
              />
              <span
                className={[
                  'block rounded-[0.375rem] px-3 py-1.5 text-label font-semibold transition-colors duration-200',
                  'peer-focus-visible:outline peer-focus-visible:outline-2',
                  'peer-focus-visible:outline-offset-2 peer-focus-visible:outline-line-focus',
                  checked
                    ? 'bg-surface-card text-brand-700 shadow-card'
                    : 'text-ink-muted hover:text-ink-primary',
                ].join(' ')}
              >
                {item.label}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
