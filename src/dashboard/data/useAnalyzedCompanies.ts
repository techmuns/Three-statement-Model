/**
 * The companies already analyzed (data on the site) — for the search box's
 * "open instantly" dropdown. Refetched whenever `refreshKey` changes, so a
 * company that was just analyzed shows up without a reload.
 */

import { useEffect, useState } from 'react'
import { fetchAnalyzedCompanies } from './financials'
import { companyName, type CompanyHit } from './companySearch'

export function useAnalyzedCompanies(refreshKey?: unknown): CompanyHit[] {
  const [list, setList] = useState<CompanyHit[]>([])

  useEffect(() => {
    let live = true
    fetchAnalyzedCompanies().then((symbols) => {
      if (!live) return
      setList(
        symbols
          .map((s) => ({ symbol: s.toUpperCase(), name: companyName(s) ?? s, sector: '' }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
    })
    return () => {
      live = false
    }
  }, [refreshKey])

  return list
}
