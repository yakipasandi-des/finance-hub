import { useState, useCallback, useRef } from 'react'
import type React from 'react'

interface ResizeHandleProps {
  side: 'left' | 'right'
  cardId: string
  currentSpan: 1 | 2 | 3 | 4
  gridRef: React.RefObject<HTMLDivElement | null>
  onResize: (cardId: string, span: 1 | 2 | 3 | 4) => void
  visible: boolean
}

export function ResizeHandle({ side, cardId, currentSpan, gridRef, onResize, visible }: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false)
  const startRef = useRef<{ x: number; span: number; colWidth: number } | null>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)

    const grid = gridRef.current
    if (!grid) return

    const gridRect = grid.getBoundingClientRect()
    const colWidth = gridRect.width / 4
    startRef.current = {
      x: e.clientX,
      span: currentSpan,
      colWidth,
    }
    setDragging(true)
  }, [gridRef, currentSpan])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!startRef.current) return
    const { span, colWidth } = startRef.current

    const deltaX = e.clientX - startRef.current.x
    const deltaCols = Math.round(deltaX / colWidth)

    // RTL: right is the leading edge, left is the trailing edge
    let newSpan: number
    if (side === 'right') {
      newSpan = span + deltaCols
    } else {
      newSpan = span - deltaCols
    }

    newSpan = Math.max(1, Math.min(4, newSpan)) as 1 | 2 | 3 | 4
    if (newSpan !== currentSpan) {
      onResize(cardId, newSpan as 1 | 2 | 3 | 4)
    }
  }, [side, cardId, currentSpan, onResize])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement
    el.releasePointerCapture(e.pointerId)
    startRef.current = null
    setDragging(false)
  }, [])

  const style: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 6,
    [side]: 0,
    cursor: 'col-resize',
    zIndex: 10,
    background: dragging ? 'var(--accent)' : 'var(--border)',
    opacity: dragging ? 0.8 : visible ? 0.5 : 0,
    borderRadius: 3,
    transition: dragging ? 'none' : 'opacity 0.15s',
    touchAction: 'none',
  }

  return (
    <div
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onMouseDown={(e) => e.stopPropagation()}
      onDragStart={(e) => { e.preventDefault(); e.stopPropagation() }}
      draggable={false}
    />
  )
}
