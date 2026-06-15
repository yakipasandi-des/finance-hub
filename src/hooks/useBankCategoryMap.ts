import { useState, useCallback } from 'react'

// Vendor→category map for bank entries — set a category once per vendor (in the
// mapping tab) and it applies to all rows with that vendor. Fully manual; a
// per-row BankEntry.categoryId overrides this map for an individual row.
const LS_KEY = 'bankCategoryMap'

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

export function useBankCategoryMap() {
  const [map, setMap] = useState<Record<string, string>>(loadFromStorage)

  const setMapping = useCallback((vendor: string, categoryId: string | null) => {
    setMap((prev) => {
      const next = { ...prev }
      if (!categoryId) {
        delete next[vendor]
      } else {
        next[vendor] = categoryId
      }
      saveToStorage(next)
      return next
    })
  }, [])

  return { map, setMapping }
}
