import { useState, useCallback } from 'react'
import type { SavingsAccount } from '../types'

const LS_KEY = 'savings'
const GOAL_KEY = 'savings-goal'

function loadGoal(): number {
  try {
    const raw = localStorage.getItem(GOAL_KEY)
    if (raw) {
      const n = JSON.parse(raw)
      if (typeof n === 'number' && n >= 0) return n
    }
  } catch { /* ignore */ }
  return 0
}

function load(): SavingsAccount[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SavingsAccount[]
      if (Array.isArray(parsed)) return parsed.map((a) => ({ ...a, updatedAt: a.updatedAt ?? Date.now() }))
    }
  } catch { /* ignore */ }
  return []
}

function save(accounts: SavingsAccount[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(accounts))
}

function makeId(): string {
  return `sav_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function useSavings() {
  const [accounts, setAccounts] = useState<SavingsAccount[]>(load)
  const [savingsGoal, setSavingsGoalState] = useState<number>(loadGoal)

  const setSavingsGoal = useCallback((amount: number) => {
    const val = Math.max(0, amount)
    setSavingsGoalState(val)
    localStorage.setItem(GOAL_KEY, JSON.stringify(val))
  }, [])

  const addAccount = useCallback(() => {
    const next: SavingsAccount = { id: makeId(), name: '', managedBy: '', amount: 0, updatedAt: Date.now() }
    setAccounts((prev) => {
      const updated = [next, ...prev]
      save(updated)
      return updated
    })
    return next.id
  }, [])

  const updateAccount = useCallback((id: string, changes: Partial<Omit<SavingsAccount, 'id'>>) => {
    setAccounts((prev) => {
      const updated = prev.map((a) => a.id === id ? { ...a, ...changes, updatedAt: Date.now() } : a)
      save(updated)
      return updated
    })
  }, [])

  const deleteAccount = useCallback((id: string) => {
    setAccounts((prev) => {
      const updated = prev.filter((a) => a.id !== id)
      save(updated)
      return updated
    })
  }, [])

  return { accounts, addAccount, updateAccount, deleteAccount, savingsGoal, setSavingsGoal }
}
