import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Category, DEFAULT_CATEGORIES } from '../categories'

const LS_KEY = 'categories'

const EMOJI_MIGRATION: Record<string, string> = {
  '🛒': 'ShoppingCart', '🍽️': 'UtensilsCrossed', '🚗': 'Car', '🏠': 'Home',
  '🏥': 'Heart', '🛍️': 'ShoppingBag', '📱': 'Smartphone', '👶': 'Baby',
  '🎬': 'Film', '📦': 'Package', '💊': 'Pill', '⚡': 'Zap',
  '🏋️': 'Dumbbell', '✈️': 'Plane', '🎓': 'GraduationCap', '💇': 'Scissors',
  '🐾': 'PawPrint', '🎁': 'Gift', '🔧': 'Wrench', '💰': 'Wallet',
  '🎵': 'Music', '🎮': 'Gamepad2', '🌿': 'TreePine', '☕': 'Coffee',
  '🍕': 'Pizza', '🎪': 'Star', '🏊': 'Dumbbell', '📚': 'BookOpen',
  '💼': 'Briefcase', '🏖️': 'Sun',
}

function migrateIcon(icon: string): string {
  return EMOJI_MIGRATION[icon] ?? icon
}

function load(): Category[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Category[]
      if (Array.isArray(parsed) && parsed.length > 0)
        return parsed.map((c) => ({ ...c, icon: migrateIcon(c.icon) }))
    }
  } catch { /* ignore */ }
  return DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sortOrder: i }))
}

function persist(cats: Category[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(cats))
}

function makeId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '')
  return `${slug || 'cat'}_${Date.now()}`
}

// ---------------------------------------------------------------------------

interface CategoriesContextValue {
  categories: Category[]
  addCategory: (name: string, icon: string, color: string) => void
  updateCategory: (id: string, changes: Partial<Pick<Category, 'name' | 'icon' | 'color'>>) => void
  deleteCategory: (id: string) => void
  reorderCategories: (ordered: Category[]) => void
  /** Moves all merchants from `fromId` to `toId`, then removes `fromId`. Caller must update merchantMap. */
  mergeInto: (fromId: string, toId: string, updateMerchantMap: (fromId: string, toId: string) => void) => void
  resetToDefaults: () => void
}

const CategoriesContext = createContext<CategoriesContextValue | null>(null)

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(load)

  const set = useCallback((next: Category[]) => {
    persist(next)
    setCategories(next)
  }, [])

  const addCategory = useCallback((name: string, icon: string, color: string) => {
    setCategories((prev) => {
      const next: Category = { id: makeId(name), name, icon, color, sortOrder: prev.length }
      const updated = [...prev, next]
      persist(updated)
      return updated
    })
  }, [])

  const updateCategory = useCallback((id: string, changes: Partial<Pick<Category, 'name' | 'icon' | 'color'>>) => {
    setCategories((prev) => {
      const updated = prev.map((c) => c.id === id ? { ...c, ...changes } : c)
      persist(updated)
      return updated
    })
  }, [])

  const deleteCategory = useCallback((id: string) => {
    setCategories((prev) => {
      const updated = prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, sortOrder: i }))
      persist(updated)
      return updated
    })
  }, [])

  const reorderCategories = useCallback((ordered: Category[]) => {
    set(ordered.map((c, i) => ({ ...c, sortOrder: i })))
  }, [set])

  const mergeInto = useCallback((
    fromId: string,
    toId: string,
    updateMerchantMap: (fromId: string, toId: string) => void,
  ) => {
    updateMerchantMap(fromId, toId)
    setCategories((prev) => {
      const updated = prev.filter((c) => c.id !== fromId).map((c, i) => ({ ...c, sortOrder: i }))
      persist(updated)
      return updated
    })
  }, [])

  const resetToDefaults = useCallback(() => {
    set(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sortOrder: i })))
  }, [set])

  return (
    <CategoriesContext.Provider value={{
      categories, addCategory, updateCategory, deleteCategory,
      reorderCategories, mergeInto, resetToDefaults,
    }}>
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories(): CategoriesContextValue {
  const ctx = useContext(CategoriesContext)
  if (!ctx) throw new Error('useCategories must be used within CategoriesProvider')
  return ctx
}
