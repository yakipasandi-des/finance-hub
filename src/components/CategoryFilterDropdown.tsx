import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { CategoryIcon } from '../icons'

// Shared category-filter dropdown — used by the global FilterBar and the
// mapping screen so the two stay visually and behaviorally identical.
// Multi-select, with "select all / clear" and per-option counts.

export interface CategoryFilterOption {
  id: string
  name: string
  icon: string
  color: string
  count: number
}

interface CategoryFilterDropdownProps {
  options: CategoryFilterOption[]
  selected: string[]
  onToggle: (id: string) => void
  onSelectAll: () => void
  onClear: () => void
}

export function CategoryFilterDropdown({
  options, selected, onToggle, onSelectAll, onClear,
}: CategoryFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const single = selected.length === 1 ? options.find((c) => c.id === selected[0]) : null
  const label =
    selected.length === 0
      ? 'כל הקטגוריות'
      : selected.length === 1
      ? (single?.name ?? '1 קטגוריה')
      : `${selected.length} קטגוריות`

  return (
    <div ref={ref} style={s.dropWrap}>
      <button
        style={{ ...s.dropBtn, ...(selected.length > 0 ? s.dropBtnActive : {}) }}
        onClick={() => setOpen((o) => !o)}
      >
        {single && <CategoryIcon icon={single.icon} size={13} />}
        {label} <ChevronDown size={12} strokeWidth={2} />
      </button>
      {open && (
        <div style={s.dropdown}>
          <div style={s.dropHeader}>
            <button style={s.selectAll} onClick={onSelectAll}>בחר הכל</button>
            <button style={s.selectAll} onClick={onClear}>נקה הכל</button>
          </div>
          {options.map((c) => (
            <label key={c.id} style={s.dropRow}>
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => onToggle(c.id)}
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
  )
}

const s: Record<string, React.CSSProperties> = {
  dropWrap: { position: 'relative' },
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
}
