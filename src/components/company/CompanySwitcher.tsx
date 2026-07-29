import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { MOCK_COMPANIES, searchCompanies, type MockCompany } from '@/mocks/companies'
import { useOnClickOutside } from '@/hooks/useOnClickOutside'
import { CompanyAvatar } from './CompanyAvatar'
import { cn } from '@/lib/cn'

export interface CompanySwitcherProps {
  company: MockCompany
  onSelect: (company: MockCompany) => void
}

/**
 * Searchable company picker.
 *
 * Implements the ARIA combobox pattern with an attached listbox: the input owns
 * `aria-expanded`/`aria-controls`, and `aria-activedescendant` points at the
 * visually highlighted option while DOM focus stays in the input. Keyboard:
 * Down/Up move the active option (wrapping), Home/End jump to the ends, Enter
 * commits, Escape closes and restores the committed company, Tab closes.
 *
 * Filtering is a substring match over the hardcoded list. When the real company
 * universe arrives this becomes a debounced query — the markup does not change.
 */
export function CompanySwitcher({ company, onSelect }: CompanySwitcherProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const baseId = useId()
  const listboxId = `${baseId}-listbox`
  const optionId = (id: string) => `${baseId}-option-${id}`

  const matches = useMemo(() => (open ? searchCompanies(query) : MOCK_COMPANIES), [open, query])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  useOnClickOutside(rootRef, close, open)

  // Keep the highlighted option in range as the filter narrows, and scroll it
  // into view — the list is scrollable once it exceeds the popover height.
  useEffect(() => {
    if (activeIndex > matches.length - 1) setActiveIndex(0)
  }, [matches.length, activeIndex])

  useEffect(() => {
    if (!open) return
    const active = matches[activeIndex]
    if (!active) return
    listRef.current
      ?.querySelector(`#${CSS.escape(optionId(active.id))}`)
      ?.scrollIntoView({ block: 'nearest' })
    // `optionId` is derived from a stable `useId`, so it is not a real dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex, matches])

  const openWith = (nextQuery = '') => {
    setQuery(nextQuery)
    setOpen(true)
    const index = MOCK_COMPANIES.findIndex((item) => item.id === company.id)
    setActiveIndex(nextQuery ? 0 : Math.max(index, 0))
  }

  const commit = (selected: MockCompany | undefined) => {
    if (selected) onSelect(selected)
    close()
    inputRef.current?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const last = matches.length - 1

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (!open) return openWith(query)
        setActiveIndex((index) => (index >= last ? 0 : index + 1))
        return
      case 'ArrowUp':
        event.preventDefault()
        if (!open) return openWith(query)
        setActiveIndex((index) => (index <= 0 ? last : index - 1))
        return
      case 'Home':
        if (!open) return
        event.preventDefault()
        setActiveIndex(0)
        return
      case 'End':
        if (!open) return
        event.preventDefault()
        setActiveIndex(last)
        return
      case 'Enter':
        if (!open) return
        event.preventDefault()
        commit(matches[activeIndex])
        return
      case 'Escape':
        if (!open) return
        event.preventDefault()
        close()
        return
      case 'Tab':
        if (open) close()
        return
      default:
    }
  }

  const activeOption = open ? matches[activeIndex] : undefined

  return (
    <div ref={rootRef} className="relative w-full sm:w-72">
      <label htmlFor={`${baseId}-input`} className="sr-only">
        Select a company
      </label>

      <div
        className={cn(
          'flex items-center gap-2 rounded-control border bg-surface-card px-2.5 py-1.5 transition-colors',
          open ? 'border-brand-400' : 'border-line-strong hover:border-brand-300',
        )}
      >
        <CompanyAvatar company={company} size="sm" />

        <input
          ref={inputRef}
          id={`${baseId}-input`}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOption ? optionId(activeOption.id) : undefined}
          // While closed the field displays the committed company; typing or
          // opening swaps it for the editable query.
          value={open ? query : company.name}
          placeholder={open ? 'Search companies…' : undefined}
          onChange={(event) => {
            if (!open) setOpen(true)
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          onFocus={(event) => event.target.select()}
          onMouseDown={() => {
            if (!open) openWith()
          }}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent text-title font-semibold text-ink-primary outline-none placeholder:font-normal placeholder:text-ink-subtle"
        />

        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => (open ? close() : openWith())}
          className="shrink-0 text-ink-subtle"
        >
          <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
            <path
              d="m6 8 4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Companies"
          className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-control border border-line-hairline bg-surface-overlay py-1 shadow-overlay"
        >
          {matches.length === 0 && (
            <li role="presentation" className="px-3 py-6 text-center text-caption text-ink-subtle">
              No company matches “{query}”.
            </li>
          )}

          {matches.map((item, index) => {
            const active = index === activeIndex
            const selected = item.id === company.id

            return (
              <li
                key={item.id}
                id={optionId(item.id)}
                role="option"
                aria-selected={selected}
                // Options are driven by aria-activedescendant, so the pointer
                // must not steal focus from the input.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(item)}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 px-2.5 py-2',
                  active && 'bg-brand-50',
                )}
              >
                <CompanyAvatar company={item} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-title font-semibold text-ink-primary">
                    {item.name}
                  </span>
                  <span className="block truncate text-caption text-ink-subtle">
                    {item.ticker} · {item.sector}
                  </span>
                </span>
                {selected && (
                  <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-brand-600" fill="none">
                    <title>Selected</title>
                    <path
                      d="m5 10.5 3.5 3.5L15 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
