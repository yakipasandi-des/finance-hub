import {
  createContext, useContext, useState, useMemo,
  useEffect, useRef, ReactNode,
} from 'react'
import type { Transaction, BankEntry } from '../types'
import { useCategories } from './CategoriesContext'
import { getChildCategories } from '../categories'
import { resolveBankCategoryId } from '../utils/bankCategory'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Filters {
  months: string[]      // "2026-01" keys; empty = all
  categories: string[]  // category IDs + '_uncat'; empty = all
  amountMin: number
  amountMax: number
}

export interface AvailableMonth {
  key: string    // "2026-01"
  label: string  // "ינואר 2026"
  count: number
}

export interface AvailableCategory {
  id: string
  name: string
  icon: string
  color: string
  count: number
}

/** A manually-categorized bank expense, normalized for insights. */
export interface BankExpenseItem {
  date: Date
  amount: number
  categoryId: string
  vendor: string
  recurring: boolean
}

interface FilterContextValue {
  filters: Filters
  updateFilters: (partial: Partial<Filters>) => void
  resetFilters: () => void
  filteredTransactions: Transaction[]
  allTransactions: Transaction[]
  /** Bank rows the user assigned a category to (payment > 0), passing the active filters. */
  filteredBankExpenses: BankExpenseItem[]
  availableMonths: AvailableMonth[]
  availableCategories: AvailableCategory[]
  maxAmount: number
  activeFilterCount: number
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const FilterContext = createContext<FilterContextValue | null>(null)

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
interface FilterProviderProps {
  transactions: Transaction[]
  map: Record<string, string>
  bankEntries: BankEntry[]
  bankCategoryMap: Record<string, string>
  children: ReactNode
}

export function FilterProvider({ transactions, map, bankEntries, bankCategoryMap, children }: FilterProviderProps) {
  const { categories } = useCategories()

  // Bank expense rows with a resolved category (per-row override or vendor map) — fed into insights.
  const bankItems = useMemo<BankExpenseItem[]>(
    () => bankEntries
      .filter((e) => e.payment > 0)
      .map((e) => ({ date: e.date, amount: e.payment, categoryId: resolveBankCategoryId(e, bankCategoryMap), vendor: e.vendor, recurring: e.recurring }))
      .filter((b): b is BankExpenseItem => !!b.categoryId),
    [bankEntries, bankCategoryMap],
  )

  const maxAmount = useMemo(
    () => {
      const amounts = [...transactions.map((t) => t.amount), ...bankItems.map((b) => b.amount)]
      return amounts.length > 0 ? Math.ceil(Math.max(...amounts)) : 1000
    },
    [transactions, bankItems],
  )

  const [filters, setFilters] = useState<Filters>({
    months: [], categories: [], amountMin: 0, amountMax: maxAmount,
  })

  // Reset when a new file is uploaded (maxAmount changes)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    setFilters({ months: [], categories: [], amountMin: 0, amountMax: maxAmount })
  }, [maxAmount])

  const updateFilters = (partial: Partial<Filters>) =>
    setFilters((prev) => ({ ...prev, ...partial }))

  const resetFilters = () =>
    setFilters({ months: [], categories: [], amountMin: 0, amountMax: maxAmount })

  // Available months derived from all transactions + categorized bank expenses
  const availableMonths = useMemo<AvailableMonth[]>(() => {
    const m = new Map<string, number>()
    const bump = (d: Date) => {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      m.set(key, (m.get(key) ?? 0) + 1)
    }
    for (const tx of transactions) bump(tx.date)
    for (const b of bankItems) bump(b.date)
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => {
      const [year, month] = key.split('-')
      return { key, label: `${HEBREW_MONTHS[parseInt(month) - 1]} ${year}`, count }
    })
  }, [transactions, bankItems])

  // Available categories with counts (credit-card + categorized bank expenses)
  const availableCategories = useMemo<AvailableCategory[]>(() => {
    const cats: AvailableCategory[] = categories
      .map((cat) => ({
        ...cat,
        count:
          transactions.filter((tx) => map[tx.merchant] === cat.id).length +
          bankItems.filter((b) => b.categoryId === cat.id).length,
      }))
      .filter((c) => c.count > 0)

    const uncatCount = transactions.filter((tx) => !map[tx.merchant]).length
    if (uncatCount > 0) {
      cats.push({ id: '_uncat', name: 'ללא קטגוריה', icon: 'Package', color: '#c4c7ce', count: uncatCount })
    }
    return cats
  }, [transactions, map, bankItems])

  // Expand parent filter selections to include their children
  const expandedCategoryFilter = useMemo(() => {
    if (filters.categories.length === 0) return []
    const expanded = new Set(filters.categories)
    for (const catId of filters.categories) {
      for (const child of getChildCategories(catId, categories)) {
        expanded.add(child.id)
      }
    }
    return [...expanded]
  }, [filters.categories, categories])

  // Apply all filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filters.months.length > 0) {
        const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`
        if (!filters.months.includes(key)) return false
      }
      if (expandedCategoryFilter.length > 0) {
        const catId = map[tx.merchant] ?? '_uncat'
        if (!expandedCategoryFilter.includes(catId)) return false
      }
      if (tx.amount < filters.amountMin || tx.amount > filters.amountMax) return false
      return true
    })
  }, [transactions, map, filters, expandedCategoryFilter])

  // Apply the same month / category / amount filters to bank expense items
  const filteredBankExpenses = useMemo(() => {
    return bankItems.filter((it) => {
      if (filters.months.length > 0) {
        const key = `${it.date.getFullYear()}-${String(it.date.getMonth() + 1).padStart(2, '0')}`
        if (!filters.months.includes(key)) return false
      }
      if (expandedCategoryFilter.length > 0 && !expandedCategoryFilter.includes(it.categoryId)) return false
      if (it.amount < filters.amountMin || it.amount > filters.amountMax) return false
      return true
    })
  }, [bankItems, filters, expandedCategoryFilter])

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filters.months.length > 0) n++
    if (filters.categories.length > 0) n++
    if (filters.amountMin > 0 || filters.amountMax < maxAmount) n++
    return n
  }, [filters, maxAmount])

  return (
    <FilterContext.Provider value={{
      filters, updateFilters, resetFilters,
      filteredTransactions, allTransactions: transactions,
      filteredBankExpenses,
      availableMonths, availableCategories,
      maxAmount, activeFilterCount,
    }}>
      {children}
    </FilterContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useFilters(): FilterContextValue {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilters must be used inside FilterProvider')
  return ctx
}
