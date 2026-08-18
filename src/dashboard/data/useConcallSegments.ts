/**
 * Load a company's revenue-mix-by-segment from the Concall Deep Dive app,
 * re-fetching when the ticker changes. `null` while loading or when the company
 * has no concall report yet — the segment card falls back to "not reported".
 */

import { useEffect, useState } from 'react'
import { fetchConcallSegments, type ConcallSegments } from './segments'

export function useConcallSegments(ticker: string): { data: ConcallSegments | null; loading: boolean } {
  const [data, setData] = useState<ConcallSegments | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    setLoading(true)
    setData(null)
    fetchConcallSegments(ticker).then((result) => {
      if (!live) return
      setData(result)
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [ticker])

  return { data, loading }
}
