import { useState, useCallback } from 'react'
import type { SavingsAccount, FundType, InflationData } from '../types'

const LS_KEY = 'savings'
const GOAL_KEY = 'savings-goal'
const INFLATION_KEY = 'inflationData'

export const FUND_TYPE_LABELS: Record<FundType, string> = {
  gemel: 'קופת גמל להשקעה',
  hishtalmut: 'קרן השתלמות',
  bituach: 'ביטוח מנהלים',
  pensia: 'פנסיה',
  polisat: 'פוליסת חיסכון',
  other: 'אחר',
}

export const FUND_TYPE_COLORS: Record<FundType, string> = {
  gemel: '#4338ca',
  hishtalmut: '#0d9488',
  bituach: '#b45309',
  pensia: '#7c3aed',
  polisat: '#0ea5e9',
  other: '#78716c',
}

export const PROVIDERS = [
  'מור', 'הראל', 'מגדל', 'כלל', 'הפניקס', 'מיטב', 'אלטשולר שחם', 'פסגות', 'מנורה', 'אחר',
]

function guessFundType(name: string): FundType {
  if (/גמל/i.test(name)) return 'gemel'
  if (/השתלמות/i.test(name)) return 'hishtalmut'
  if (/ביטוח/i.test(name)) return 'bituach'
  if (/פנסי/i.test(name)) return 'pensia'
  if (/פוליס/i.test(name)) return 'polisat'
  return 'other'
}

function migrateAccount(old: Record<string, unknown>): SavingsAccount {
  const fundType = guessFundType(String(old.name ?? ''))
  const now = new Date().toISOString().slice(0, 10)
  return {
    id: (old.id as string) ?? makeId(),
    name: String(old.name ?? ''),
    provider: String(old.managedBy ?? old.provider ?? ''),
    planName: String(old.planName ?? old.name ?? ''),
    fundType: (old.fundType as FundType) ?? fundType,
    fundCode: String(old.fundCode ?? ''),
    currentAmount: Number(old.currentAmount ?? old.amount ?? 0),
    lastUpdated: String(old.lastUpdated ?? now),
    yields: (old.yields as SavingsAccount['yields']) ?? {
      monthly: null, ytd: null, twelveMonth: null, threeYear: null, lastYieldUpdate: now,
    },
    yieldHistory: (old.yieldHistory as SavingsAccount['yieldHistory']) ?? [],
    managementFee: (old.managementFee as number | null) ?? null,
    notes: String(old.notes ?? ''),
    color: String(old.color ?? FUND_TYPE_COLORS[fundType]),
    sortOrder: Number(old.sortOrder ?? 0),
    // Legacy compat fields
    managedBy: String(old.managedBy ?? old.provider ?? ''),
    amount: Number(old.currentAmount ?? old.amount ?? 0),
    updatedAt: Number(old.updatedAt ?? Date.now()),
  }
}

function load(): SavingsAccount[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>[]
      if (Array.isArray(parsed)) {
        // Detect old format by checking for 'managedBy' without 'planName'
        const needsMigration = parsed.length > 0 && parsed[0].managedBy !== undefined && parsed[0].planName === undefined
        if (needsMigration) {
          const migrated = parsed.map(migrateAccount)
          save(migrated)
          return migrated
        }
        return parsed.map(migrateAccount)
      }
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

const DEFAULT_INFLATION: InflationData = {
  annual: 3.2,
  lastUpdated: new Date().toISOString().slice(0, 10),
  monthlyHistory: [],
}

function loadInflation(): InflationData {
  try {
    const raw = localStorage.getItem(INFLATION_KEY)
    if (raw) return { ...DEFAULT_INFLATION, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULT_INFLATION
}

export function useSavings() {
  const [accounts, setAccounts] = useState<SavingsAccount[]>(load)
  const [savingsGoal, setSavingsGoalState] = useState<number>(loadGoal)
  const [inflation, setInflationState] = useState<InflationData>(loadInflation)

  const setSavingsGoal = useCallback((amount: number) => {
    const val = Math.max(0, amount)
    setSavingsGoalState(val)
    localStorage.setItem(GOAL_KEY, JSON.stringify(val))
  }, [])

  const setInflation = useCallback((data: Partial<InflationData>) => {
    setInflationState(prev => {
      const next = { ...prev, ...data }
      localStorage.setItem(INFLATION_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const addAccount = useCallback((initial?: Partial<SavingsAccount>) => {
    const fundType = initial?.fundType ?? 'other'
    const now = new Date().toISOString().slice(0, 10)
    const next: SavingsAccount = {
      id: makeId(),
      name: '',
      provider: '',
      planName: '',
      fundType,
      fundCode: '',
      currentAmount: 0,
      lastUpdated: now,
      yields: { monthly: null, ytd: null, twelveMonth: null, threeYear: null, lastYieldUpdate: now },
      yieldHistory: [],
      managementFee: null,
      notes: '',
      color: FUND_TYPE_COLORS[fundType],
      sortOrder: 0,
      managedBy: '',
      amount: 0,
      updatedAt: Date.now(),
      ...initial,
    }
    next.id = makeId() // always generate fresh id
    setAccounts(prev => {
      const updated = [next, ...prev]
      save(updated)
      return updated
    })
    return next.id
  }, [])

  const updateAccount = useCallback((id: string, changes: Partial<Omit<SavingsAccount, 'id'>>) => {
    setAccounts(prev => {
      const updated = prev.map(a => {
        if (a.id !== id) return a
        const merged = { ...a, ...changes }
        // Sync legacy fields
        if (changes.currentAmount !== undefined) {
          merged.amount = changes.currentAmount
        }
        if (changes.provider !== undefined) {
          merged.managedBy = changes.provider
        }
        merged.updatedAt = Date.now()
        return merged
      })
      save(updated)
      return updated
    })
  }, [])

  const deleteAccount = useCallback((id: string) => {
    setAccounts(prev => {
      const updated = prev.filter(a => a.id !== id)
      save(updated)
      return updated
    })
  }, [])

  return {
    accounts, addAccount, updateAccount, deleteAccount,
    savingsGoal, setSavingsGoal,
    inflation, setInflation,
  }
}
