import { useState, useEffect, useRef } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useCategories } from '../context/CategoriesContext'
import { CategoryIcon } from '../icons'

interface CategoryChipProps {
  merchant: string
  map: Record<string, string>
  setMapping: (merchant: string, categoryId: string | null) => void
}

export function CategoryChip({ merchant, map, setMapping }: CategoryChipProps) {
  const { categories } = useCategories()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const catId = map[merchant]
  const cat = categories.find((c) => c.id === catId)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const chipBg = cat ? cat.color + '22' : 'var(--bg-primary)'
  const chipColor = cat ? cat.color : 'var(--text-faint)'

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: chipBg,
          color: chipColor,
          border: `1px solid ${cat ? cat.color + '44' : 'var(--border)'}`,
          borderRadius: '6px',
          padding: '3px 8px',
          fontSize: '12px',
          fontFamily: 'inherit',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          direction: 'rtl',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
        }}
      >
        {cat && <CategoryIcon icon={cat.icon} size={12} />}
        {cat ? cat.name : '+ קטגוריה'}
        <ChevronDown size={11} strokeWidth={2} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            right: 0,
            zIndex: 100,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: '200px',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {catId && (
            <button
              onClick={() => { setMapping(merchant, null); setOpen(false) }}
              style={itemStyle('#8e85a8')}
            >
              <X size={11} strokeWidth={2} /> הסר קטגוריה
            </button>
          )}
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => { setMapping(merchant, c.id); setOpen(false) }}
              style={{
                ...itemStyle(c.color),
                background: catId === c.id ? c.color + '22' : 'transparent',
              }}
            >
              <CategoryIcon icon={c.icon} size={13} /> {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function itemStyle(color: string): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    textAlign: 'right',
    padding: '7px 10px',
    border: 'none',
    borderRadius: '6px',
    background: 'transparent',
    color,
    fontSize: '13px',
    fontFamily: 'inherit',
    fontWeight: 500,
    cursor: 'pointer',
    direction: 'rtl',
  }
}
