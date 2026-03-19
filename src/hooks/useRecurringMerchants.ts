import { useState, useCallback } from 'react'

const LS_KEY = 'recurringMerchants'

function loadFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveToStorage(set: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...set]))
}

export function useRecurringMerchants() {
  const [recurringMerchants, setRecurringMerchants] = useState<Set<string>>(loadFromStorage)

  const toggleRecurring = useCallback((merchant: string) => {
    setRecurringMerchants((prev) => {
      const next = new Set(prev)
      if (next.has(merchant)) {
        next.delete(merchant)
      } else {
        next.add(merchant)
      }
      saveToStorage(next)
      return next
    })
  }, [])

  return { recurringMerchants, toggleRecurring }
}
