/**
 * Standalone company search — an ARIA combobox in the header.
 *
 * Two modes in one dropdown:
 *  • Empty + focused → the companies already analyzed (data on the site), so an
 *    analyst can click one and open it instantly — no waiting, no re-typing.
 *  • Typing → autocomplete over the full registry (with an "instant" dot on the
 *    ones already analyzed), plus free-text Enter to pull any listed symbol.
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { searchCompanies, type CompanyHit } from '../data/companySearch'
import { T } from './tokens'

export function SearchBox({
  currentSymbol,
  currentName,
  onSelect,
  analyzed = [],
}: {
  currentSymbol: string | null
  currentName: string | null
  onSelect: (symbol: string) => void
  /** Already-analyzed companies, shown as instant picks when the box is empty. */
  analyzed?: readonly CompanyHit[]
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const typing = query.trim().length > 0
  const analyzedSet = useMemo(
    () => new Set(analyzed.map((a) => a.symbol.toUpperCase())),
    [analyzed],
  )
  const list: readonly CompanyHit[] = typing ? searchCompanies(query) : analyzed

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
      setActive((a) => Math.min(a + 1, Math.max(list.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && list[active]) commit(list[active].symbol)
      else if (query.trim()) commit(query)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const placeholder = currentSymbol
    ? `${currentSymbol}${currentName && currentName !== currentSymbol ? ` · ${currentName}` : ''}`
    : 'Search a company…'

  const activeIdx = Math.min(active, Math.max(list.length - 1, 0))

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
        onFocus={() => {
          setActive(0)
          setOpen(true)
        }}
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
      {open && list.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 'calc(100% + 4px)',
            width: 320,
            background: '#fff',
            border: `1px solid ${T.hairline}`,
            borderRadius: 10,
            boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
            zIndex: 30,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '7px 12px 6px',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: T.inkHint,
              borderBottom: `1px solid ${T.borderDefault}`,
              background: T.cardHeaderBg,
            }}
          >
            {typing ? 'Results' : `Analyzed · open instantly (${analyzed.length})`}
          </div>
          <ul
            id="company-search-list"
            role="listbox"
            style={{
              margin: 0,
              padding: 4,
              maxHeight: 320,
              overflowY: 'auto',
              listStyle: 'none',
            }}
          >
            {list.map((h, i) => {
              const instant = analyzedSet.has(h.symbol.toUpperCase())
              return (
                <li
                  key={h.symbol}
                  role="option"
                  aria-selected={i === activeIdx}
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
                    background: i === activeIdx ? T.primaryLight : 'transparent',
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
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: T.inkSecondary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h.name}
                  </span>
                  {instant && (
                    <span
                      title="Already analyzed — opens instantly"
                      style={{
                        flexShrink: 0,
                        fontSize: 9,
                        fontWeight: 700,
                        color: T.primaryText,
                        background: T.primaryLight,
                        borderRadius: 5,
                        padding: '1px 6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      instant
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          {!typing && (
            <div
              style={{
                padding: '6px 12px',
                fontSize: 11,
                color: T.inkHint,
                borderTop: `1px solid ${T.borderDefault}`,
              }}
            >
              Type to search all ~500 companies.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
