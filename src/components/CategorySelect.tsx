import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { buildCategoryTree } from '../categories'
import { useCategories } from '../context/CategoriesContext'
import { CategoryIcon } from '../icons'

// Single-select category dropdown with parent/child tree, icons and colors.
// Shared by the merchant mapper and the bank-vendor mapper. Controlled via
// { value, onChange } — passing null clears the assignment.
interface CategorySelectProps {
  value: string | undefined
  onChange: (categoryId: string | null) => void
  width?: number
  placeholder?: string
}

export function CategorySelect({ value, onChange, width = 180, placeholder = 'ללא קטגוריה' }: CategorySelectProps) {
  const { categories } = useCategories()
  const [open, setOpen] = useState(false)
  const [expandedParent, setExpandedParent] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const cat = categories.find((c) => c.id === value)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const triggerBg = cat ? cat.color + '18' : 'var(--bg-surface)'
  const triggerColor = cat ? cat.color : 'var(--text-muted)'
  const triggerBorder = cat ? cat.color + '44' : 'var(--border)'

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0, width }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px',
          border: `1px solid ${triggerBorder}`,
          borderRadius: 8,
          background: triggerBg,
          color: triggerColor,
          fontSize: 12,
          fontFamily: 'inherit',
          fontWeight: 600,
          cursor: 'pointer',
          direction: 'rtl',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {cat ? <CategoryIcon icon={cat.icon} size={13} /> : null}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cat ? cat.name : placeholder}
          </span>
        </span>
        <ChevronDown size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 200,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          minWidth: 200, padding: 6,
          display: 'flex', flexDirection: 'column', gap: 2,
          direction: 'ltr',
          maxHeight: 320, overflowY: 'auto',
        }}>
        <div style={{ direction: 'rtl', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {value && (
            <button
              onClick={() => { onChange(null); setOpen(false) }}
              style={optStyle('var(--text-muted)')}
            >
              <X size={11} strokeWidth={2} /> הסר קטגוריה
            </button>
          )}
          {buildCategoryTree(categories).map((node) => {
            const hasChildren = node.children.length > 0
            const isExpanded = expandedParent === node.parent.id
            return (
              <div key={node.parent.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  <button
                    onClick={() => { onChange(node.parent.id); setOpen(false) }}
                    style={{ ...optStyle(node.parent.color), background: value === node.parent.id ? node.parent.color + '22' : 'transparent', fontWeight: 700, flex: 1, paddingLeft: hasChildren ? 2 : 10 }}
                  >
                    <CategoryIcon icon={node.parent.icon} size={13} /> {node.parent.name}
                  </button>
                  {hasChildren && (
                    <button
                      onClick={() => setExpandedParent(isExpanded ? null : node.parent.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, padding: 0, border: 'none', borderRadius: 4,
                        background: 'transparent', cursor: 'pointer', color: node.parent.color, flexShrink: 0,
                      }}
                    >
                      <ChevronDown size={12} strokeWidth={2} style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s' }} />
                    </button>
                  )}
                </div>
                {hasChildren && isExpanded && node.children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => { onChange(child.id); setOpen(false) }}
                    style={{ ...optStyle(child.color), background: value === child.id ? child.color + '22' : 'transparent', paddingRight: 32 }}
                  >
                    <CategoryIcon icon={child.icon} size={13} /> {child.name}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
        </div>
      )}
    </div>
  )
}

function optStyle(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', textAlign: 'right',
    padding: '7px 10px', border: 'none', borderRadius: 6,
    background: 'transparent', color,
    fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
    cursor: 'pointer',
  }
}
