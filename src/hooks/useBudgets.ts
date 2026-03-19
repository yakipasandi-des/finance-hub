import { useState, useCallback } from 'react'

const LS_KEY = 'budgets'

function load(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    }
  } catch { /* ignore */ }
  return {}
}

function save(budgets: Record<string, number>) {
  localStorage.setItem(LS_KEY, JSON.stringify(budgets))
}

export function useBudgets() {
  const [budgets, setBudgets] = useState<Record<string, number>>(load)

  const setBudget = useCallback((categoryId: string, amount: number) => {
    setBudgets((prev) => {
      const next = { ...prev, [categoryId]: amount }
      save(next)
      return next
    })
  }, [])

  const removeBudget = useCallback((categoryId: string) => {
    setBudgets((prev) => {
      const next = { ...prev }
      delete next[categoryId]
      save(next)
      return next
    })
  }, [])

  return { budgets, setBudget, removeBudget }
}
