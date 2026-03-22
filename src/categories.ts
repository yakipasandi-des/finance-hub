export interface Category {
  id: string
  name: string
  icon: string
  color: string
  sortOrder: number
  parentId?: string  // if set, this is a sub-category of the parent
}

export interface CategoryTreeNode {
  parent: Category
  children: Category[]
}

/** Returns only top-level categories (no parentId). */
export function getParentCategories(cats: Category[]): Category[] {
  return cats.filter((c) => !c.parentId)
}

/** Returns sub-categories of the given parent. */
export function getChildCategories(parentId: string, cats: Category[]): Category[] {
  return cats.filter((c) => c.parentId === parentId)
}

/** Returns the parent category ID. If the category is already top-level, returns its own ID. */
export function getEffectiveParentId(catId: string, cats: Category[]): string {
  const cat = cats.find((c) => c.id === catId)
  return cat?.parentId ?? catId
}

/** Builds a tree of parent → children for dropdowns/UI. */
export function buildCategoryTree(cats: Category[]): CategoryTreeNode[] {
  const parents = getParentCategories(cats).sort((a, b) => a.sortOrder - b.sortOrder)
  return parents.map((parent) => ({
    parent,
    children: getChildCategories(parent.id, cats).sort((a, b) => a.sortOrder - b.sortOrder),
  }))
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'groceries',     name: 'מזון וסופר',           icon: 'ShoppingCart',    color: '#5ba08a', sortOrder: 0 },
  { id: 'dining',        name: 'מסעדות ואוכל בחוץ',    icon: 'UtensilsCrossed', color: '#c49a4a', sortOrder: 1 },
  { id: 'transport',     name: 'תחבורה ודלק',           icon: 'Car',             color: '#9b8bd4', sortOrder: 2 },
  { id: 'housing',       name: 'דיור',                  icon: 'Home',            color: '#7c6fd4', sortOrder: 3 },
  { id: 'health',        name: 'בריאות וביטוח',         icon: 'Heart',           color: '#d97090', sortOrder: 4 },
  { id: 'shopping',      name: 'קניות',                 icon: 'ShoppingBag',     color: '#cc88d0', sortOrder: 5 },
  { id: 'subscriptions', name: 'מנויים וחשבונות',       icon: 'Smartphone',      color: '#6ab3d8', sortOrder: 6 },
  { id: 'kids',          name: 'ילדים וחינוך',          icon: 'Baby',            color: '#e8b86d', sortOrder: 7 },
  { id: 'entertainment', name: 'בילויים ופנאי',         icon: 'Film',            color: '#e88ab4', sortOrder: 8 },
  { id: 'other',         name: 'אחר',                   icon: 'Package',         color: '#8e85a8', sortOrder: 9 },
]

export const PALETTE_COLORS = [
  '#7c6fd4', '#5ba08a', '#c49a4a', '#d97090',
  '#9b8bd4', '#6ab3d8', '#cc88d0', '#e8b86d',
  '#e88ab4', '#8e85a8', '#6aab8e', '#d4849a',
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#2c3e50', '#8e44ad',
  '#d35400', '#27ae60', '#2980b9', '#c0392b',
]

export const EMOJI_PRESETS = [
  'ShoppingCart', 'UtensilsCrossed', 'Car', 'Home', 'Heart', 'ShoppingBag', 'Smartphone', 'Baby', 'Film', 'Package',
  'Pill', 'Zap', 'Dumbbell', 'Plane', 'GraduationCap', 'Scissors', 'PawPrint', 'Gift', 'Wrench', 'Wallet',
  'Coffee', 'Music', 'Gamepad2', 'BookOpen', 'Star', 'Globe', 'Camera', 'Bike', 'Train', 'Briefcase',
]

const AUTO_SUGGEST_RULES: { patterns: string[]; category: string }[] = [
  {
    patterns: ['מיני זול', 'שופרסל', 'רמי לוי', 'סופר', 'מרקט', 'יוחננוף', 'ויקטורי', 'חצי חינם', 'אושר עד', 'טיב טעם', 'קינג סטור'],
    category: 'groceries',
  },
  {
    patterns: ['מסעדה', 'פיצה', 'מקדונלד', 'ברגר', 'קפה', 'בית קפה', 'wolt', 'תן ביס', 'מילק', 'שווארמה', 'סושי', 'פלאפל'],
    category: 'dining',
  },
  {
    patterns: ['דלק', 'סונול', 'פז', 'דור אלון', 'אלון', 'ten', 'רכבת', 'אגד', 'דן', 'חניון', 'חנייה', 'מטרו', 'אוטובוס'],
    category: 'transport',
  },
  {
    patterns: ['הראל', 'ביטוח', 'מאוחדת', 'כללית', 'מכבי', 'לאומית', 'קופ"ח', 'קופת חולים', 'בית מרקחת', 'סופר פארם', 'שומרה', 'מגדל', 'הפניקס'],
    category: 'health',
  },
  {
    patterns: ['גן ילדים', 'צהרון', 'חוגים', 'בית ספר', 'העמותה', 'חינוך', 'שיעורים'],
    category: 'kids',
  },
  {
    patterns: ['נטפליקס', 'ספוטיפי', 'אפל', 'גוגל', 'אמזון', 'סלקום', 'פרטנר', 'הוט', 'בזק', 'yes', 'מירס', 'רנדום', 'icloud'],
    category: 'subscriptions',
  },
  {
    patterns: ['זארה', 'h&m', 'קסטרו', 'רנואר', 'גולף', 'פוקס', 'קפיטל', 'אדידס', 'נייקי', 'ace', 'איקאה', 'המחסן'],
    category: 'shopping',
  },
  {
    patterns: ['דיור', 'שכירות', 'ועד', 'ארנונה', 'חשמל', 'מים', 'גז'],
    category: 'housing',
  },
  {
    patterns: ['סינמה', 'קולנוע', 'תיאטרון', 'בילוי', 'פנאי', 'ספורט', 'כושר', 'מכון כושר', 'גולדס', 'הולמס'],
    category: 'entertainment',
  },
]

export function autoSuggest(merchant: string): string | null {
  const lower = merchant.toLowerCase()
  for (const rule of AUTO_SUGGEST_RULES) {
    for (const pattern of rule.patterns) {
      if (lower.includes(pattern.toLowerCase())) return rule.category
    }
  }
  return null
}

/** Look up a category in a dynamic list. Falls back to DEFAULT_CATEGORIES. */
export function getCategoryById(id: string, categories: Category[] = DEFAULT_CATEGORIES): Category | undefined {
  return categories.find((c) => c.id === id)
}
