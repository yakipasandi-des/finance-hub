import { useState, useCallback } from 'react'
import { autoSuggest } from '../categories'
import type { Transaction } from '../types'

const LS_KEY = 'merchantCategoryMap'

function loadFromStorage(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function saveToStorage(map: Record<string, string>) {
  localStorage.setItem(LS_KEY, JSON.stringify(map))
}

export function useCategoryMap() {
  const [map, setMap] = useState<Record<string, string>>(loadFromStorage)

  /** Call after parsing — fills in auto-suggestions for unknown merchants */
  const applyAutoSuggest = useCallback((transactions: Transaction[]) => {
    setMap((prev) => {
      const next = { ...prev }
      let changed = false
      for (const tx of transactions) {
        if (!next[tx.merchant]) {
          const cat = autoSuggest(tx.merchant)
          if (cat) {
            next[tx.merchant] = cat
            changed = true
          }
        }
      }
      if (changed) saveToStorage(next)
      return changed ? next : prev
    })
  }, [])

  /** Set or remove a merchant→category mapping */
  const setMapping = useCallback((merchant: string, categoryId: string | null) => {
    setMap((prev) => {
      const next = { ...prev }
      if (!categoryId) {
        delete next[merchant]
      } else {
        next[merchant] = categoryId
      }
      saveToStorage(next)
      return next
    })
  }, [])

  return { map, setMapping, applyAutoSuggest }
}
