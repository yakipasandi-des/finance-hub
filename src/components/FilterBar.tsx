import { useState, useRef, useEffect } from 'react'
import { SlidersHorizontal, ChevronDown } from 'lucide-react'
import { useFilters } from '../context/FilterContext'
import { CategoryIcon } from '../icons'

type SpendFilter = 'all' | 'variable' | 'recurring'

interface FilterBarProps {
  spendFilter?: SpendFilter
  setSpendFilter?: (f: SpendFilter) => void
  recurringTotal?: number
  variableTotal?: number
  total?: number
}

export function FilterBar({ spendFilter, setSpendFilter, recurringTotal, variableTotal, total: spendTotal }: FilterBarProps = {}) {
  const {
    filters, updateFilters, resetFilters,
    availableMonths, availableCategories,
    maxAmount, activeFilterCount,
    filteredTransactions, allTransactions,
  } = useFilters()

  const [monthOpen, setMonthOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [spendOpen, setSpendOpen] = useState(false)
  const monthRef = useRef<HTMLDivElement>(null)
  const catRef = useRef<HTMLDivElement>(null)
  const spendRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    if (!monthOpen && !catOpen && !spendOpen) return
    const handler = (e: MouseEvent) => {
      if (monthOpen && monthRef.current && !monthRef.current.contains(e.target as Node)) setMonthOpen(false)
      if (catOpen && catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false)
      if (spendOpen && spendRef.current && !spendRef.current.contains(e.target as Node)) setSpendOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [monthOpen, catOpen, spendOpen])

  // Month toggle
  const toggleMonth = (key: string) => {
    const next = filters.months.includes(key)
      ? filters.months.filter((m) => m !== key)
      : [...filters.months, key]
    updateFilters({ months: next })
  }

  // Category toggle
  const toggleCategory = (id: string) => {
    const next = filters.categories.includes(id)
      ? filters.categories.filter((c) => c !== id)
      : [...filters.categories, id]
    updateFilters({ categories: next })
  }

  // Month button label
  const monthLabel =
    filters.months.length === 0
      ? 'כל החודשים'
      : filters.months.length === 1
      ? (availableMonths.find((m) => m.key === filters.months[0])?.label ?? '1 חודש')
      : `${filters.months.length} חודשים`

  // Category button label
  const singleCat = filters.categories.length === 1
    ? availableCategories.find((c) => c.id === filters.categories[0])
    : null
  const catLabelText =
    filters.categories.length === 0
      ? 'כל הקטגוריות'
      : filters.categories.length === 1
      ? (singleCat?.name ?? '1 קטגוריה')
      : `${filters.categories.length} קטגוריות`

  // Amount slider
  const minPct = maxAmount > 0 ? (filters.amountMin / maxAmount) * 100 : 0
  const maxPct = maxAmount > 0 ? (filters.amountMax / maxAmount) * 100 : 100

  const amountPresets = [
    { label: 'עד ₪100', min: 0, max: 100 },
    { label: '₪100–500', min: 100, max: 500 },
    { label: 'מעל ₪500', min: 500, max: maxAmount },
  ]

  const isAmountFiltered = filters.amountMin > 0 || filters.amountMax < maxAmount
  const showNote = activeFilterCount > 0

  return (
    <div style={s.wrap}>
      <div style={s.bar}>
        {/* Label */}
        <span style={s.label}><SlidersHorizontal size={13} strokeWidth={1.75} /> סינון</span>

        {/* Month dropdown */}
        <div ref={monthRef} style={s.dropWrap}>
          <button
            style={{ ...s.dropBtn, ...(filters.months.length > 0 ? s.dropBtnActive : {}) }}
            onClick={() => { setMonthOpen((o) => !o); setCatOpen(false); setSpendOpen(false) }}
          >
            {monthLabel} <ChevronDown size={12} strokeWidth={2} />
          </button>
          {monthOpen && (
            <div style={s.dropdown}>
              <div style={s.dropHeader}>
                <button style={s.selectAll} onClick={() => updateFilters({ months: availableMonths.map((m) => m.key) })}>בחר הכל</button>
                <button style={s.selectAll} onClick={() => updateFilters({ months: [] })}>נקה הכל</button>
              </div>
              {availableMonths.map((m) => (
                <label key={m.key} style={s.dropRow}>
                  <input
                    type="checkbox"
                    checked={filters.months.includes(m.key)}
                    onChange={() => toggleMonth(m.key)}
                    style={{ accentColor: 'var(--accent)', flexShrink: 0 }}
                  />
                  <span style={s.dropRowLabel}>{m.label}</span>
                  <span style={s.dropRowCount}>{m.count}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Category dropdown */}
        <div ref={catRef} style={s.dropWrap}>
          <button
            style={{ ...s.dropBtn, ...(filters.categories.length > 0 ? s.dropBtnActive : {}) }}
            onClick={() => { setCatOpen((o) => !o); setMonthOpen(false); setSpendOpen(false) }}
          >
            {singleCat && <CategoryIcon icon={singleCat.icon} size={13} />}
            {catLabelText} <ChevronDown size={12} strokeWidth={2} />
          </button>
          {catOpen && (
            <div style={s.dropdown}>
              <div style={s.dropHeader}>
                <button style={s.selectAll} onClick={() => updateFilters({ categories: availableCategories.map((c) => c.id) })}>בחר הכל</button>
                <button style={s.selectAll} onClick={() => updateFilters({ categories: [] })}>נקה הכל</button>
              </div>
              {availableCategories.map((c) => (
                <label key={c.id} style={s.dropRow}>
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(c.id)}
                    onChange={() => toggleCategory(c.id)}
                    style={{ accentColor: c.color, flexShrink: 0 }}
                  />
                  <span style={{ ...s.dropRowLabel, color: c.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CategoryIcon icon={c.icon} size={14} />
                    {c.name}
                  </span>
                  <span style={s.dropRowCount}>{c.count}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Spend type dropdown */}
        {spendFilter && setSpendFilter && (
          <div ref={spendRef} style={s.dropWrap}>
            <button
              style={{ ...s.dropBtn, ...(spendFilter !== 'all' ? s.dropBtnActive : {}) }}
              onClick={() => { setSpendOpen((o) => !o); setMonthOpen(false); setCatOpen(false) }}
            >
              {spendFilter === 'all' ? 'סוג הוצאות' : spendFilter === 'recurring' ? 'הוצאות קבועות' : 'הוצאות משתנות'}
              {' '}<ChevronDown size={12} strokeWidth={2} />
            </button>
            {spendOpen && (
              <div style={s.dropdown}>
                {([
                  ['all', 'הכל'],
                  ['variable', 'הוצאות משתנות'],
                  ['recurring', 'הוצאות קבועות'],
                ] as [SpendFilter, string][]).map(([id, label]) => (
                  <label
                    key={id}
                    style={{ ...s.dropRow, background: spendFilter === id ? 'var(--accent-fill)' : undefined, fontWeight: spendFilter === id ? 600 : undefined }}
                    onClick={() => { setSpendFilter(id); setSpendOpen(false) }}
                  >
                    <span style={{ ...s.dropRowLabel, color: spendFilter === id ? 'var(--accent)' : undefined }}>{label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Amount range */}
        <div style={s.amountWrap}>
          <span style={s.amountLabel}>
            ₪{filters.amountMin.toLocaleString()} — ₪{filters.amountMax.toLocaleString()}
          </span>
          {/* Slider track */}
          <div style={{ position: 'relative', width: 180 }}>
            {/* Background track */}
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 4, background: 'var(--bg-primary)', borderRadius: 2, transform: 'translateY(-50%)' }} />
            {/* Filled range */}
            <div style={{
              position: 'absolute', top: '50%', left: `${minPct}%`, right: `${100 - maxPct}%`,
              height: 4, background: isAmountFiltered ? 'var(--accent)' : '#c0b8d8',
              borderRadius: 2, transform: 'translateY(-50%)',
            }} />
            <div className="dual-range-wrap" style={{ width: 180 }}>
              <input
                type="range"
                min={0}
                max={maxAmount}
                step={10}
                value={filters.amountMin}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (v <= filters.amountMax) updateFilters({ amountMin: v })
                }}
                style={{ zIndex: filters.amountMin >= filters.amountMax - 10 ? 5 : 3 }}
              />
              <input
                type="range"
                min={0}
                max={maxAmount}
                step={10}
                value={filters.amountMax}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (v >= filters.amountMin) updateFilters({ amountMax: v })
                }}
                style={{ zIndex: 4 }}
              />
            </div>
          </div>
          {/* Presets */}
          <div style={s.presets}>
            {amountPresets.map((p) => {
              const isActive = filters.amountMin === p.min && filters.amountMax === p.max
              return (
                <button
                  key={p.label}
                  style={{ ...s.preset, ...(isActive ? s.presetActive : {}) }}
                  onClick={() => updateFilters(isActive ? { amountMin: 0, amountMax: maxAmount } : { amountMin: p.min, amountMax: p.max })}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        {showNote && (
          <span style={s.note}>
            מציג {filteredTransactions.length} מתוך {allTransactions.length} עסקאות
          </span>
        )}
        {spendFilter && spendFilter !== 'all' && recurringTotal !== undefined && variableTotal !== undefined && spendTotal !== undefined && (
          <span style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
            קבועות: ₪{recurringTotal.toLocaleString('he-IL', { maximumFractionDigits: 0 })} ({spendTotal > 0 ? Math.round(recurringTotal / spendTotal * 100) : 0}%)
            {' | '}
            משתנות: ₪{variableTotal.toLocaleString('he-IL', { maximumFractionDigits: 0 })} ({spendTotal > 0 ? Math.round(variableTotal / spendTotal * 100) : 0}%)
          </span>
        )}

        {/* Reset */}
        <button
          style={{ ...s.resetBtn, ...(activeFilterCount > 0 ? s.resetBtnActive : {}) }}
          onClick={resetFilters}
          disabled={activeFilterCount === 0}
        >
          איפוס
          {activeFilterCount > 0 && (
            <span style={s.badge}>{activeFilterCount}</span>
          )}
        </button>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 16px',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border)',
    direction: 'rtl',
    flexWrap: 'wrap',
  },
  label: {
    display: 'flex', alignItems: 'center', gap: '5px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  dropWrap: {
    position: 'relative',
  },
  dropBtn: {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '6px 14px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    fontFamily: 'inherit',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  dropBtnActive: {
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
    background: 'var(--accent-fill)',
    fontWeight: 700,
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    zIndex: 200,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
    minWidth: '200px',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    direction: 'rtl',
  },
  dropHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 6px 8px',
    borderBottom: '1px solid var(--border)',
    marginBottom: '4px',
  },
  selectAll: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: '11px',
    fontFamily: 'inherit',
    cursor: 'pointer',
    fontWeight: 600,
    padding: 0,
  },
  dropRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  dropRowLabel: {
    flex: 1,
    color: 'var(--text-secondary)',
  },
  dropRowCount: {
    fontSize: '11px',
    color: 'var(--text-faint)',
    background: 'var(--bg-primary)',
    borderRadius: '999px',
    padding: '1px 6px',
  },
  amountWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginRight: '4px',
    direction: 'ltr',  // keep slider LTR
  },
  amountLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    minWidth: '100px',
    textAlign: 'center',
    direction: 'ltr',
  },
  presets: {
    display: 'flex',
    gap: '4px',
  },
  preset: {
    padding: '3px 8px',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    background: 'var(--bg-primary)',
    color: 'var(--text-muted)',
    fontSize: '11px',
    fontFamily: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  presetActive: {
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
    background: 'var(--accent-fill)',
    fontWeight: 700,
  },
  resetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 12px',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    background: 'var(--bg-primary)',
    color: 'var(--text-faint)',
    fontSize: '12px',
    fontFamily: 'inherit',
    cursor: 'not-allowed',
    marginRight: 'auto',
  },
  resetBtnActive: {
    color: 'var(--red)',
    borderColor: 'var(--red)',
    background: 'rgba(239, 68, 68, 0.06)',
    cursor: 'pointer',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: 'var(--red)',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 700,
  },
  note: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--accent)',
    fontWeight: 500,
    direction: 'rtl',
    whiteSpace: 'nowrap',
  },
}
