import { useState, useCallback, useRef } from 'react'

/**
 * Hook for resizable table columns.
 * Returns column widths and a resize handle renderer.
 *
 * @param storageKey - localStorage key for persisting widths
 * @param defaultWidths - initial widths per column index (in px)
 */
export function useColumnResize(storageKey: string, defaultWidths: number[]) {
  const [widths, setWidths] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length === defaultWidths.length) return parsed
      }
    } catch { /* ignore */ }
    return defaultWidths
  })

  const dragging = useRef<{ col: number; startX: number; startWidth: number } | null>(null)

  const onMouseDown = useCallback((col: number, e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = widths[col]
    dragging.current = { col, startX, startWidth }

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      // RTL: dragging left increases width
      const diff = dragging.current.startX - ev.clientX
      const newWidth = Math.max(40, dragging.current.startWidth + diff)
      setWidths((prev) => {
        const next = [...prev]
        next[dragging.current!.col] = newWidth
        return next
      })
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setWidths((prev) => {
        localStorage.setItem(storageKey, JSON.stringify(prev))
        return prev
      })
      dragging.current = null
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [widths, storageKey])

  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: -2,
    width: 7,
    height: '100%',
    cursor: 'col-resize',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const handleLineStyle: React.CSSProperties = {
    width: 2,
    height: '60%',
    borderRadius: 1,
    background: 'var(--border)',
    transition: 'background 0.15s, height 0.15s',
  }

  const handleLineHoverStyle: React.CSSProperties = {
    ...handleLineStyle,
    background: 'var(--accent)',
    height: '80%',
  }

  const thStyle = (col: number): React.CSSProperties => ({
    width: widths[col],
    minWidth: widths[col],
    position: 'relative',
  })

  return { widths, onMouseDown, handleStyle, handleLineStyle, handleLineHoverStyle, thStyle }
}
