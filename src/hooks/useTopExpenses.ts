import { useMemo } from 'react'
import type { Transaction } from '../types'
import type { Category } from '../categories'
import { getEffectiveParentId } from '../categories'

export interface TopExpenseItem {
  merchant: string
  amount: number
  categoryId: string | null
  categoryName: string
  categoryColor: string
  categoryIcon: string
  pctOfTotal: number
  isRecurring: boolean
  isOverBudget: boolean
  periodChange: number | null   // % change vs previous period, null = no previous data
  date: Date                    // date of the largest transaction for this merchant
  categoryTotal: number         // total category spend in current period
  monthsAppeared: number        // distinct months this merchant appears in (all history)
  totalMonths: number           // total distinct months in all transactions
  monthlyAvg: number | null     // average monthly spend, null if only 1 month
}

interface Params {
  transactions: Transaction[]
  allTransactions: Transaction[]
  map: Record<string, string>
  categories: Category[]
  budgets: Record<string, number>
  recurringMerchants: Set<string>
  selectedMonths: string[]
  topN: number
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function isRecurring(tx: Transaction, recurringMerchants: Set<string>): boolean {
  const autoDetected = tx.notes === 'הוראת קבע' || (tx.notes?.includes('תשלום') ?? false)
  const inSet = recurringMerchants.has(tx.merchant)
  return autoDetected ? !inSet : inSet
}

function getPreviousPeriodMonths(selectedMonths: string[]): string[] {
  if (selectedMonths.length === 0) return []
  const count = selectedMonths.length
  return [...selectedMonths].sort().map((mk) => {
    const [y, m] = mk.split('-').map(Number)
    const d = new Date(y, m - 1 - count, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

export function useTopExpenses({
  transactions,
  allTransactions,
  map,
  categories,
  budgets,
  recurringMerchants,
  selectedMonths,
  topN,
}: Params) {
  return useMemo(() => {
    // 1. Aggregate by merchant
    const byMerchant = new Map<string, { total: number; recurring: boolean; largestTx: Transaction }>()
    for (const tx of transactions) {
      if (tx.amount <= 0) continue
      const existing = byMerchant.get(tx.merchant)
      if (existing) {
        existing.total += tx.amount
        if (!existing.recurring) existing.recurring = isRecurring(tx, recurringMerchants)
        if (tx.amount > existing.largestTx.amount) existing.largestTx = tx
      } else {
        byMerchant.set(tx.merchant, {
          total: tx.amount,
          recurring: isRecurring(tx, recurringMerchants),
          largestTx: tx,
        })
      }
    }

    // 2. Total spend
    const total = Array.from(byMerchant.values()).reduce((s, v) => s + v.total, 0)

    // 3. Category totals for over-budget detection
    const catTotals: Record<string, number> = {}
    for (const tx of transactions) {
      if (tx.amount <= 0) continue
      const catId = map[tx.merchant]
      if (!catId) continue
      const parentId = getEffectiveParentId(catId, categories)
      catTotals[parentId] = (catTotals[parentId] ?? 0) + tx.amount
    }

    // 4. Previous period merchant totals
    const prevMonths = getPreviousPeriodMonths(selectedMonths)
    const prevByMerchant = new Map<string, number>()
    if (prevMonths.length > 0) {
      const prevSet = new Set(prevMonths)
      for (const tx of allTransactions) {
        if (tx.amount <= 0) continue
        if (!prevSet.has(monthKey(tx.date))) continue
        prevByMerchant.set(tx.merchant, (prevByMerchant.get(tx.merchant) ?? 0) + tx.amount)
      }
    }

    // 5. Frequency: count distinct months per merchant across all history
    const allMonthSet = new Set<string>()
    const merchantMonths = new Map<string, Set<string>>()
    const merchantAllTotal = new Map<string, number>()
    for (const tx of allTransactions) {
      if (tx.amount <= 0) continue
      const mk = monthKey(tx.date)
      allMonthSet.add(mk)
      if (!merchantMonths.has(tx.merchant)) merchantMonths.set(tx.merchant, new Set())
      merchantMonths.get(tx.merchant)!.add(mk)
      merchantAllTotal.set(tx.merchant, (merchantAllTotal.get(tx.merchant) ?? 0) + tx.amount)
    }
    const totalMonths = allMonthSet.size

    // 6. Build items, sort, take top N
    const sorted = Array.from(byMerchant.entries())
      .map(([merchant, data]) => ({ merchant, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, topN)

    const maxAmount = sorted[0]?.total ?? 0

    const items: TopExpenseItem[] = sorted.map((row) => {
      const catId = map[row.merchant] ?? null
      const resolvedParentId = catId ? getEffectiveParentId(catId, categories) : null
      const cat = categories.find((c) => c.id === (catId ?? ''))

      // Over-budget: check parent category budget
      let isOverBudget = false
      if (resolvedParentId && budgets[resolvedParentId] != null) {
        const parentTotal = catTotals[resolvedParentId] ?? 0
        isOverBudget = parentTotal > budgets[resolvedParentId]
      }

      // Period change
      let periodChange: number | null = null
      if (prevMonths.length > 0) {
        const prev = prevByMerchant.get(row.merchant)
        if (prev != null && prev > 0) {
          periodChange = ((row.total - prev) / prev) * 100
        }
        // null means new (didn't exist in previous period)
      }

      // Category total for this merchant's category
      const catTotal = resolvedParentId ? (catTotals[resolvedParentId] ?? 0) : 0

      // Frequency
      const appeared = merchantMonths.get(row.merchant)?.size ?? 1
      const allTotal = merchantAllTotal.get(row.merchant) ?? row.total

      return {
        merchant: row.merchant,
        amount: row.total,
        categoryId: catId,
        categoryName: cat?.name ?? 'ללא קטגוריה',
        categoryColor: cat?.color ?? '#8e85a8',
        categoryIcon: cat?.icon ?? 'Package',
        pctOfTotal: total > 0 ? (row.total / total) * 100 : 0,
        isRecurring: row.recurring,
        isOverBudget,
        periodChange,
        date: row.largestTx.date,
        categoryTotal: catTotal,
        monthsAppeared: appeared,
        totalMonths,
        monthlyAvg: appeared >= 2 ? allTotal / appeared : null,
      }
    })

    return { items, total, maxAmount }
  }, [transactions, allTransactions, map, categories, budgets, recurringMerchants, selectedMonths, topN])
}
