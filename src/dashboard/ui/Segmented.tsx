/**
 * A compact single-choice segmented control, used for the tab switch and the
 * 5-quarter / 5-year period toggle in the header. Built on native radios so
 * keyboard and group semantics come from the platform.
 */

import { type CSSProperties } from 'react'
import { T, TRANSITION } from './tokens'

export interface SegmentedOption<Id extends string> {
  id: Id
  label: string
}

export function Segmented<Id extends string>({
  name,
  options,
  value,
  onChange,
  ariaLabel,
}: {
  name: string
  options: readonly SegmentedOption<Id>[]
  value: Id
  onChange: (id: Id) => void
  ariaLabel: string
}) {
  return (
    <fieldset
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        border: `1px solid ${T.hairline}`,
        borderRadius: 8,
        padding: 2,
        margin: 0,
        background: '#fff',
        gap: 2,
      }}
    >
      {options.map((option) => {
        const active = option.id === value
        const style: CSSProperties = {
          fontSize: 12,
          fontWeight: 600,
          padding: '4px 10px',
          borderRadius: 6,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: TRANSITION,
          color: active ? T.primaryText : T.inkMuted,
          background: active ? T.primaryLight : 'transparent',
        }
        return (
          <label key={option.id} style={style}>
            <input
              type="radio"
              name={name}
              checked={active}
              onChange={() => onChange(option.id)}
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            />
            {option.label}
          </label>
        )
      })}
    </fieldset>
  )
}
