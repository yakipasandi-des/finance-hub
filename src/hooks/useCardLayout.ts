import { useState, useCallback } from 'react'
import type React from 'react'

export interface CardLayout {
  id: string
  colSpan: 1 | 2 | 3 | 4
}

const OLD_CARD_ORDER_KEY = 'finance-hub-insight-card-order'

function loadLayout(storageKey: string, defaults: CardLayout[]): CardLayout[] {
  try {
    // Migration: convert old flat string[] format to CardLayout[]
    if (storageKey === 'finance-hub-insights-layout') {
      const oldRaw = localStorage.getItem(OLD_CARD_ORDER_KEY)
      if (oldRaw) {
        const oldOrder = JSON.parse(oldRaw) as string[]
        const defaultMap = new Map(defaults.map((d) => [d.id, d.colSpan]))
        const migrated: CardLayout[] = oldOrder
          .filter((id) => defaultMap.has(id))
          .map((id) => ({ id, colSpan: defaultMap.get(id)! }))
        // Add any missing cards from defaults
        for (const d of defaults) {
          if (!migrated.some((m) => m.id === d.id)) {
            migrated.push(d)
          }
        }
        localStorage.setItem(storageKey, JSON.stringify(migrated))
        localStorage.removeItem(OLD_CARD_ORDER_KEY)
        return migrated
      }
    }

    const raw = localStorage.getItem(storageKey)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as CardLayout[]
    const defaultIds = new Set(defaults.map((d) => d.id))
    const parsedIds = new Set(parsed.map((p) => p.id))

    // Self-heal: must contain exactly the right card IDs
    if (defaultIds.size !== parsedIds.size || ![...defaultIds].every((id) => parsedIds.has(id))) {
      // Keep order/spans for known cards, append missing ones
      const healed: CardLayout[] = []
      for (const p of parsed) {
        if (defaultIds.has(p.id)) healed.push(p)
      }
      for (const d of defaults) {
        if (!healed.some((h) => h.id === d.id)) healed.push(d)
      }
      return healed
    }
    return parsed
  } catch {
    return defaults
  }
}

export function useCardLayout(storageKey: string, defaults: CardLayout[]) {
  const [layout, setLayout] = useState<CardLayout[]>(() => loadLayout(storageKey, defaults))
  const [draggedCard, setDraggedCard] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const updateSpan = useCallback((cardId: string, span: 1 | 2 | 3 | 4) => {
    setLayout((prev) => {
      const next = prev.map((c) => c.id === cardId ? { ...c, colSpan: span } : c)
      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }, [storageKey])

  const handleDragStart = useCallback((cardId: string) => (e: React.DragEvent) => {
    setDraggedCard(cardId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', cardId)
    if (e.currentTarget instanceof HTMLElement) {
      requestAnimationFrame(() => {
        if (e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.opacity = '0.5'
        }
      })
    }
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedCard(null)
    setDropTarget(null)
  }, [])

  const handleDragOver = useCallback((cardId: string) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(cardId)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDropTarget(null)
  }, [])

  const handleDrop = useCallback((targetCard: string) => (e: React.DragEvent) => {
    e.preventDefault()
    const sourceCard = e.dataTransfer.getData('text/plain')
    if (sourceCard === targetCard) {
      setDraggedCard(null)
      setDropTarget(null)
      return
    }
    setLayout((prev) => {
      const newLayout = [...prev]
      const srcIdx = newLayout.findIndex((c) => c.id === sourceCard)
      const tgtIdx = newLayout.findIndex((c) => c.id === targetCard)
      if (srcIdx === -1 || tgtIdx === -1) return prev
      const [moved] = newLayout.splice(srcIdx, 1)
      newLayout.splice(tgtIdx, 0, moved)
      localStorage.setItem(storageKey, JSON.stringify(newLayout))
      return newLayout
    })
    setDraggedCard(null)
    setDropTarget(null)
  }, [storageKey])

  /** Sync layout with a dynamic set of card IDs — keeps order/spans for known cards, appends new ones, removes stale ones. */
  const syncLayout = useCallback((desired: CardLayout[]) => {
    setLayout((prev) => {
      const desiredIds = new Set(desired.map((d) => d.id))
      const prevIds = new Set(prev.map((p) => p.id))
      // Nothing changed
      if (desiredIds.size === prevIds.size && [...desiredIds].every((id) => prevIds.has(id))) return prev
      // Keep order/spans for existing cards, drop removed, append new
      const kept = prev.filter((p) => desiredIds.has(p.id))
      for (const d of desired) {
        if (!kept.some((k) => k.id === d.id)) kept.push(d)
      }
      localStorage.setItem(storageKey, JSON.stringify(kept))
      return kept
    })
  }, [storageKey])

  return {
    layout,
    updateSpan,
    syncLayout,
    draggedCard,
    dropTarget,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}
