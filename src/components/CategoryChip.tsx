import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronLeft, X } from 'lucide-react'
import { useCategories } from '../context/CategoriesContext'
import { CategoryIcon } from '../icons'
import { buildCategoryTree } from '../categories'

interface CategoryChipProps {
  merchant: string
  map: Record<string, string>
  setMapping: (merchant: string, categoryId: string | null) => void
}

export function CategoryChip({ merchant, map, setMapping }: CategoryChipProps) {
  const { categories } = useCategories()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)
  const catId = map[merchant]
  const cat = categories.find((c) => c.id === catId)

  // Auto-expand the parent that contains the current selection
  useEffect(() => {
    if (!open || !catId) return
    const tree = buildCategoryTree(categories)
    for (const node of tree) {
      if (node.children.some((c) => c.id === catId)) {
        setExpanded((prev) => {
          if (prev.has(node.parent.id)) return prev
          return new Set(prev).add(node.parent.id)
        })
      }
    }
  }, [open, catId, categories])

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

  function toggleExpand(parentId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(parentId)) next.delete(parentId)
      else next.add(parentId)
      return next
    })
  }

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
            maxHeight: '320px',
            overflowY: 'auto',
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
          {buildCategoryTree(categories).map((node) => {
            const hasChildren = node.children.length > 0
            const isExpanded = expanded.has(node.parent.id)
            return (
              <div key={node.parent.id}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    onClick={() => { setMapping(merchant, node.parent.id); setOpen(false) }}
                    style={{
                      ...itemStyle(node.parent.color),
                      background: catId === node.parent.id ? node.parent.color + '22' : 'transparent',
                      fontWeight: 700,
                      flex: 1,
                    }}
                  >
                    <CategoryIcon icon={node.parent.icon} size={13} /> {node.parent.name}
                  </button>
                  {hasChildren && (
                    <button
                      onClick={(e) => toggleExpand(node.parent.id, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: 4,
                        color: node.parent.color,
                        display: 'flex',
                        alignItems: 'center',
                        opacity: 0.7,
                        flexShrink: 0,
                      }}
                      title={isExpanded ? 'כווץ' : 'הרחב'}
                    >
                      {isExpanded
                        ? <ChevronDown size={13} strokeWidth={2} />
                        : <ChevronLeft size={13} strokeWidth={2} />
                      }
                    </button>
                  )}
                </div>
                {hasChildren && isExpanded && node.children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => { setMapping(merchant, child.id); setOpen(false) }}
                    style={{
                      ...itemStyle(child.color),
                      background: catId === child.id ? child.color + '22' : 'transparent',
                      paddingRight: 22,
                    }}
                  >
                    <CategoryIcon icon={child.icon} size={13} /> {child.name}
                  </button>
                ))}
              </div>
            )
          })}
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
