import { useState, useCallback } from 'react'
import type { BankEntry, BankSettings } from '../types'

const ENTRIES_KEY = 'bankEntries'
const SETTINGS_KEY = 'bankSettings'
const RECURRING_VENDORS_KEY = 'recurringVendors'

const DEFAULT_SETTINGS: BankSettings = {
  startingBalance: 0,
  projectionMonths: 1,
}

function loadEntries(): BankEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Array<BankEntry & { date: string }>
      if (Array.isArray(parsed)) {
        return parsed.map((e) => ({ ...e, date: new Date(e.date) }))
      }
    }
  } catch { /* ignore */ }
  return []
}

function saveEntries(entries: BankEntry[]) {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
}

function loadSettings(): BankSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.startingBalance === 'number') return parsed
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS
}

function saveSettings(settings: BankSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

function loadRecurringVendors(): Set<string> {
  try {
    const raw = localStorage.getItem(RECURRING_VENDORS_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return new Set(arr)
    }
  } catch { /* ignore */ }
  return new Set()
}

function saveRecurringVendors(vendors: Set<string>) {
  localStorage.setItem(RECURRING_VENDORS_KEY, JSON.stringify([...vendors]))
}

function makeId(): string {
  return `be_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function useBankEntries() {
  const [entries, setEntries] = useState<BankEntry[]>(loadEntries)
  const [settings, setSettings] = useState<BankSettings>(loadSettings)

  const addEntry = useCallback((partial?: Partial<BankEntry>) => {
    const id = makeId()
    const next: BankEntry = {
      id,
      date: new Date(),
      status: 'expected',
      category: '',
      vendor: '',
      payment: 0,
      receipt: 0,
      recurring: false,
      source: 'manual',
      ...partial,
    }
    setEntries((prev) => {
      const updated = [next, ...prev]
      saveEntries(updated)
      return updated
    })
    return id
  }, [])

  const updateEntry = useCallback((id: string, changes: Partial<Omit<BankEntry, 'id'>>) => {
    setEntries((prev) => {
      let updated = prev.map((e) => e.id === id ? { ...e, ...changes } : e)
      saveEntries(updated)
      // Sync recurring: only one entry per vendor should be recurring
      if ('recurring' in changes) {
        const entry = updated.find((e) => e.id === id)
        if (entry && entry.vendor) {
          const vendors = loadRecurringVendors()
          if (changes.recurring) {
            vendors.add(entry.vendor)
            // Un-mark other entries with the same vendor
            updated = updated.map((e) =>
              e.vendor === entry.vendor && e.id !== id && e.recurring
                ? { ...e, recurring: false }
                : e
            )
          } else {
            vendors.delete(entry.vendor)
          }
          saveRecurringVendors(vendors)
          saveEntries(updated)
        }
      }
      return updated
    })
  }, [])

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const updated = prev.filter((e) => e.id !== id)
      saveEntries(updated)
      return updated
    })
  }, [])

  const importEntries = useCallback((newEntries: BankEntry[]) => {
    setEntries((prev) => {
      // Keep manual entries, replace all imported ones
      const manualOnly = prev.filter((e) => e.source === 'manual')
      // Reapply recurring flags: only mark one entry per vendor (the latest by date)
      const recurringVendors = loadRecurringVendors()
      // Find the latest entry ID for each recurring vendor
      const latestByVendor = new Map<string, string>()
      const sortedDesc = [...newEntries].sort((a, b) => b.date.getTime() - a.date.getTime())
      for (const e of sortedDesc) {
        if (recurringVendors.has(e.vendor) && !latestByVendor.has(e.vendor)) {
          latestByVendor.set(e.vendor, e.id)
        }
      }
      const recurringIds = new Set(latestByVendor.values())
      const withRecurring = newEntries.map((e) =>
        recurringIds.has(e.id) ? { ...e, recurring: true } : e,
      )
      const updated = [...manualOnly, ...withRecurring]
      saveEntries(updated)
      return updated
    })
  }, [])

  const clearEntries = useCallback(() => {
    setEntries([])
    saveEntries([])
  }, [])

  const updateSettings = useCallback((changes: Partial<BankSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...changes }
      saveSettings(updated)
      return updated
    })
  }, [])

  return { entries, settings, addEntry, updateEntry, deleteEntry, importEntries, clearEntries, updateSettings }
}
