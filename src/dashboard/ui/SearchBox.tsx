/**
 * Standalone company search — an ARIA combobox in the header.
 *
 * Autocompletes over the bundled registry and also accepts a free-text ticker
 * (press Enter) so any listed symbol can be pulled on demand. Selecting a
 * company sets the active ticker; the dashboard loads it (or offers Analyze).
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { searchCompanies } from '../data/companySearch'
import { T } from './tokens'

export function SearchBox({
  currentSymbol,
  currentName,
  onSelect,
}: {
  currentSymbol: string | null
  currentName: string | null
  onSelect: (symbol: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const hits = query.trim() ? searchCompanies(query) : []

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const commit = (symbol: string) => {
    const sym = symbol.trim().toUpperCase()
    if (!sym) return
    onSelect(sym)
    setQuery('')
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, Math.max(hits.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && hits[active]) commit(hits[active].symbol)
      else if (query.trim()) commit(query)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const placeholder = currentSymbol
    ? `${currentSymbol}${currentName && currentName !== currentSymbol ? ` · ${currentName}` : ''}`
    : 'Search a company…'

  return (
    <div ref={ref} style={{ position: 'relative', width: 264 }}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls="company-search-list"
        aria-autocomplete="list"
        aria-label="Search a company"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => query.trim() && setOpen(true)}
        onKeyDown={onKeyDown}
        style={{
          width: '100%',
          height: 30,
          boxSizing: 'border-box',
          padding: '0 10px',
          fontSize: 13,
          color: T.ink,
          background: '#fff',
          border: `1px solid ${T.hairline}`,
          borderRadius: 8,
          outline: 'none',
        }}
      />
      {open && hits.length > 0 && (
        <ul
          id="company-search-list"
          role="listbox"
          style={{
            position: 'absolute',
            left: 0,
            top: 'calc(100% + 4px)',
            width: 320,
            maxHeight: 340,
            overflowY: 'auto',
            margin: 0,
            padding: 4,
            listStyle: 'none',
            background: '#fff',
            border: `1px solid ${T.hairline}`,
            borderRadius: 10,
            boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
            zIndex: 30,
          }}
        >
          {hits.map((h, i) => (
            <li
              key={h.symbol}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                commit(h.symbol)
              }}
              onMouseEnter={() => setActive(i)}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                padding: '7px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                background: i === active ? T.primaryLight : 'transparent',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.primaryText,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  minWidth: 76,
                }}
              >
                {h.symbol}
              </span>
              <span style={{ fontSize: 13, color: T.inkSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {h.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
