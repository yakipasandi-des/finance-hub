import { useState, useCallback } from 'react'
import type { ManualEntry } from '../types'

const LS_KEY = 'manualEntries'

function load(): ManualEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ManualEntry[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch { /* ignore */ }
  return []
}

function save(entries: ManualEntry[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(entries))
}

function makeId(): string {
  return `me_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function useManualEntries() {
  const [entries, setEntries] = useState<ManualEntry[]>(load)

  const addEntry = useCallback((type: 'expense' | 'income') => {
    const id = makeId()
    const next: ManualEntry = { id, type, name: '', amount: 0, recurring: true, createdAt: Date.now() }
    setEntries((prev) => {
      const updated = [next, ...prev]
      save(updated)
      return updated
    })
    return id
  }, [])

  const updateEntry = useCallback((id: string, changes: Partial<Omit<ManualEntry, 'id'>>) => {
    setEntries((prev) => {
      const updated = prev.map((e) => e.id === id ? { ...e, ...changes } : e)
      save(updated)
      return updated
    })
  }, [])

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const updated = prev.filter((e) => e.id !== id)
      save(updated)
      return updated
    })
  }, [])

  return { entries, addEntry, updateEntry, deleteEntry }
}
