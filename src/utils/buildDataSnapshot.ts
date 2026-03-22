import type { Transaction, SavingsAccount, InflationData } from '../types'
import type { Category } from '../categories'
import type { Filters } from '../context/FilterContext'

interface SnapshotInput {
  allTransactions: Transaction[]
  filteredTransactions: Transaction[]
  map: Record<string, string>
  categories: Category[]
  budgets: Record<string, number>
  recurringMerchants: Set<string>
  filters: Filters
  currentTab?: string
  savingsAccounts?: SavingsAccount[]
  savingsGoal?: number
  inflation?: InflationData
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

function fmt(n: number): string {
  return n.toLocaleString('he-IL') + '₪'
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  return `${HEBREW_MONTHS[parseInt(m, 10) - 1]} ${y}`
}

function isRecurring(t: Transaction, recurringMerchants: Set<string>): boolean {
  // Matches Dashboard.tsx toggle logic:
  // Auto-detected recurring (הוראת קבע / תשלום): inSet means user EXCLUDED it
  // Manual: inSet means user INCLUDED it
  const autoDetected = t.notes === 'הוראת קבע' || (t.notes?.includes('תשלום') ?? false)
  const inSet = recurringMerchants.has(t.merchant)
  return autoDetected ? !inSet : inSet
}

export function buildDataSnapshot(input: SnapshotInput): string {
  const { allTransactions, filteredTransactions, map, categories, budgets, recurringMerchants, filters } = input
  const catMap = new Map(categories.map(c => [c.id, c]))
  const lines: string[] = []

  // --- Active filters ---
  const filterParts: string[] = []
  if (filters.months.length) filterParts.push(`חודשים: ${filters.months.map(monthLabel).join(', ')}`)
  if (filters.categories.length) filterParts.push(`קטגוריות: ${filters.categories.map(id => catMap.get(id)?.name ?? id).join(', ')}`)
  if (filters.amountMin > 0) filterParts.push(`מינימום: ${fmt(filters.amountMin)}`)
  if (filters.amountMax > 0) filterParts.push(`מקסימום: ${fmt(filters.amountMax)}`)
  if (filterParts.length) {
    lines.push(`סינון פעיל: ${filterParts.join(' | ')}`)
  }
  lines.push(`סה"כ עסקאות מסוננות: ${filteredTransactions.length}`)
  lines.push('')

  // --- Category totals ---
  const catTotals: Record<string, number> = {}
  let uncatTotal = 0
  for (const t of filteredTransactions) {
    const catId = map[t.merchant]
    if (catId) catTotals[catId] = (catTotals[catId] ?? 0) + t.amount
    else uncatTotal += t.amount
  }
  lines.push('## סיכום לפי קטגוריות')
  for (const cat of categories.filter(c => !c.parentId)) {
    const total = catTotals[cat.id] ?? 0
    if (total > 0) lines.push(`- ${cat.name}: ${fmt(Math.round(total))}`)
  }
  if (uncatTotal > 0) lines.push(`- לא ממופה: ${fmt(Math.round(uncatTotal))}`)
  lines.push('')

  // --- Monthly by category ---
  const monthGroups: Record<string, Transaction[]> = {}
  for (const t of filteredTransactions) {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`
    ;(monthGroups[key] ??= []).push(t)
  }
  const sortedMonths = Object.keys(monthGroups).sort().slice(-12)
  lines.push('## הוצאות חודשיות')
  for (const mk of sortedMonths) {
    const txs = monthGroups[mk]
    const perCat: Record<string, number> = {}
    for (const t of txs) {
      const catId = map[t.merchant] ?? '_uncat'
      perCat[catId] = (perCat[catId] ?? 0) + t.amount
    }
    const parts = Object.entries(perCat)
      .sort((a, b) => b[1] - a[1])
      .map(([id, amt]) => `${catMap.get(id)?.name ?? 'לא ממופה'} ${fmt(Math.round(amt))}`)
    lines.push(`${monthLabel(mk)}: ${parts.join(', ')}`)
  }
  lines.push('')

  // --- Top merchants ---
  const merchantTotals: Record<string, number> = {}
  for (const t of filteredTransactions) {
    merchantTotals[t.merchant] = (merchantTotals[t.merchant] ?? 0) + t.amount
  }
  const topMerchants = Object.entries(merchantTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
  lines.push('## בתי עסק מובילים')
  for (const [name, total] of topMerchants) {
    const catName = catMap.get(map[name])?.name ?? 'לא ממופה'
    lines.push(`- ${name}: ${fmt(Math.round(total))} (${catName})`)
  }
  lines.push('')

  // --- Budgets ---
  const budgetEntries = Object.entries(budgets).filter(([, v]) => v > 0)
  if (budgetEntries.length) {
    lines.push('## תקציבים')
    for (const [catId, budget] of budgetEntries) {
      const actual = catTotals[catId] ?? 0
      const catName = catMap.get(catId)?.name ?? catId
      lines.push(`- ${catName}: תקציב ${fmt(budget)}, בפועל ${fmt(Math.round(actual))}`)
    }
    lines.push('')
  }

  // --- Recurring vs variable ---
  let recurringTotal = 0
  let variableTotal = 0
  for (const t of filteredTransactions) {
    if (isRecurring(t, recurringMerchants)) recurringTotal += t.amount
    else variableTotal += t.amount
  }
  lines.push('## קבוע מול משתנה')
  lines.push(`הוצאות קבועות: ${fmt(Math.round(recurringTotal))}`)
  lines.push(`הוצאות משתנות: ${fmt(Math.round(variableTotal))}`)
  lines.push('')

  // --- Recent transactions (last 100) ---
  const recent = [...filteredTransactions]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 100)
  lines.push('## עסקאות אחרונות (עד 100)')
  for (const t of recent) {
    const d = t.date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
    const catName = catMap.get(map[t.merchant])?.name ?? ''
    lines.push(`${d} | ${t.merchant} | ${fmt(Math.round(t.amount))}${catName ? ` | ${catName}` : ''}`)
  }

  // --- Current tab ---
  if (input.currentTab) {
    lines.push('')
    lines.push(`## לשונית נוכחית: ${input.currentTab}`)
  }

  // --- Savings ---
  const accts = input.savingsAccounts ?? []
  if (accts.length > 0) {
    lines.push('')
    lines.push('## חסכונות')
    const totalSavings = accts.reduce((s, a) => s + a.currentAmount, 0)
    lines.push(`סה"כ חסכונות: ${fmt(totalSavings)}`)
    if (input.savingsGoal && input.savingsGoal > 0) {
      const progress = Math.min((totalSavings / input.savingsGoal) * 100, 100)
      lines.push(`יעד FI: ${fmt(input.savingsGoal)} (${Math.round(progress)}%)`)
    }
    if (input.inflation) {
      lines.push(`אינפלציה שנתית: ${input.inflation.annual}%`)
    }
    lines.push('')
    for (const a of accts) {
      const parts = [a.planName || a.name]
      if (a.provider) parts.push(`ספק: ${a.provider}`)
      parts.push(`סכום: ${fmt(a.currentAmount)}`)
      if (a.yields.ytd != null) parts.push(`תשואה מתחילת שנה: ${a.yields.ytd}%`)
      if (a.yields.twelveMonth != null) parts.push(`תשואה 12 חודשים: ${a.yields.twelveMonth}%`)
      if (a.yields.threeYear != null) parts.push(`תשואה 3 שנים: ${a.yields.threeYear}%`)
      if (a.managementFee != null) parts.push(`דמי ניהול: ${a.managementFee}%`)
      lines.push(`- ${parts.join(' | ')}`)
    }
  }

  // Suppress unused variable warning — allTransactions is available for callers
  void allTransactions

  return lines.join('\n')
}
