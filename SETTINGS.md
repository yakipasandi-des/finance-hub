# Settings & Category Management

## Overview
Add a settings page accessible from the app header. The main feature is full control over categories — add, edit, delete, reorder, and merge.

---

## Access
Add a ⚙️ icon button in the top-right of the app header, next to the "upload new file" button.
Clicking it opens the settings page as a full view (same as insights/mapping/transactions tabs).

Update the navigation tabs:
```
[📊 תובנות]  [🏷️ מיפוי קטגוריות]  [📋 כל העסקאות]  [⚙️ הגדרות]
```

---

## Settings Page Layout

```
┌──────────────────────────────────────────────────┐
│  הגדרות                                          │
│                                                   │
│  ┌─── ניהול קטגוריות ─────────────────────────┐  │
│  │                                              │  │
│  │  [+ קטגוריה חדשה]                            │  │
│  │                                              │  │
│  │  ☰ 🛒 מזון וסופר          [✏️] [🗑️]        │  │
│  │  ☰ 🍽️ מסעדות ואוכל בחוץ   [✏️] [🗑️]        │  │
│  │  ☰ 🚗 תחבורה ודלק         [✏️] [🗑️]        │  │
│  │  ☰ 🏠 דיור                 [✏️] [🗑️]        │  │
│  │  ☰ 🏥 בריאות וביטוח        [✏️] [🗑️]        │  │
│  │  ☰ 🛍️ קניות                [✏️] [🗑️]        │  │
│  │  ☰ 📱 מנויים וחשבונות      [✏️] [🗑️]        │  │
│  │  ☰ 👶 ילדים וחינוך         [✏️] [🗑️]        │  │
│  │  ☰ 🎬 בילויים ופנאי        [✏️] [🗑️]        │  │
│  │  ☰ 📦 אחר                  [✏️] [🗑️]        │  │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
│                                                   │
│  ┌─── כללי ───────────────────────────────────┐  │
│  │                                              │  │
│  │  ...future settings...                       │  │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

---

## Category Management Features

### 1. View All Categories
- List all categories in their sort order
- Each row shows: drag handle (☰) + icon + name + mapped merchant count + edit + delete buttons
- Merchant count: "12 בתי עסק" — how many merchants are mapped to this category
- Shows a subtle total: "₪XX,XXX סה״כ הוצאות" per category from current data

### 2. Add Category
Button: "+ קטגוריה חדשה" at the top of the list.

Opens an inline form or modal:
```
┌────────────────────────────────────────┐
│  קטגוריה חדשה                          │
│                                        │
│  שם:     [________________]            │
│  אייקון:  [😀] (click to pick)         │
│  צבע:    [● ● ● ● ● ● ● ●]           │
│                                        │
│          [ביטול]  [שמירה]               │
└────────────────────────────────────────┘
```

Fields:
- **שם (Name):** text input, required, must be unique
- **אייקון (Icon):** emoji picker — show a grid of common emojis, or let user type/paste any emoji. Preset suggestions: 🏠🛒🚗💊🎬📱👶🛍️💰📦🍽️⚡🏋️✈️🎓💇🐾🎁🔧
- **צבע (Color):** preset color palette (10-12 colors from our theme). Click to select:
  - #4338ca (indigo), #0d9488 (teal), #b45309 (amber), #e11d48 (rose)
  - #7c3aed (violet), #0ea5e9 (sky), #d946ef (fuchsia), #f59e0b (yellow)
  - #ec4899 (pink), #78716c (stone), #059669 (emerald), #dc2626 (red)

Validation:
- Name cannot be empty
- Name cannot duplicate an existing category
- Icon defaults to 📦 if not selected
- Color defaults to first unused color

### 3. Edit Category
Click ✏️ on any category → opens same form as "add" but pre-filled with current values.

Changes propagate immediately:
- Renaming a category updates it in all charts, filters, and mappings
- Changing icon/color updates everywhere
- Merchant mappings stay intact (they reference the category ID, not the name)

### 4. Delete Category
Click 🗑️ → confirmation dialog:

```
┌────────────────────────────────────────┐
│  מחיקת קטגוריה                         │
│                                        │
│  למחוק את "מסעדות ואוכל בחוץ"?        │
│                                        │
│  8 בתי עסק ממופים לקטגוריה זו.         │
│  מה לעשות עם העסקאות?                   │
│                                        │
│  ○ העבר ל: [קטגוריה אחרת ▾]           │
│  ○ סמן כללא קטגוריה                    │
│                                        │
│          [ביטול]  [מחק]                 │
└────────────────────────────────────────┘
```

- Show how many merchants are mapped to this category
- Let user choose: reassign to another category OR mark as uncategorized
- If reassigned: update all merchant mappings to the new category
- The "אחר" category cannot be deleted (it's the fallback)

### 5. Reorder Categories
Drag and drop to reorder using the ☰ handle.
Order affects:
- How categories appear in chart legends
- Dropdown order in the category filter
- Dropdown order when assigning categories to merchants

Implementation: use a simple drag-and-drop library or HTML5 drag events.
Store sort order in the categories array and persist to localStorage.

### 6. Merge Categories
Sometimes you want to combine two categories into one (e.g., merge "מסעדות" into "מזון").

Add a merge option in the edit modal or as a separate action:
```
[מזג קטגוריה אחרת לתוך זו]
```

Select which category to merge in → all its merchant mappings move to the current category → the merged category is deleted.

---

## Data Persistence

All category and mapping data lives in localStorage:

```typescript
// Categories
localStorage.setItem('categories', JSON.stringify(categories));

// Merchant-to-category mappings  
localStorage.setItem('merchantCategoryMap', JSON.stringify(map));
```

Load on app startup. If no categories exist in localStorage, use DEFAULT_CATEGORIES.

### Data structure:
```typescript
interface Category {
  id: string;           // Unique ID (slug or uuid)
  name: string;         // Display name in Hebrew
  icon: string;         // Emoji
  color: string;        // Hex color
  sortOrder: number;    // For ordering
}
```

When adding a new category, generate ID from the name (slugified) or use a simple counter/uuid.

---

## General Settings Section (below categories)

For now, keep this section minimal with placeholder for future settings:

### ניקוי נתונים (Data Management)
- **איפוס מיפויים** (Reset mappings): clears all merchant→category mappings. Confirmation required.
- **איפוס קטגוריות** (Reset categories): restores default categories. Confirmation required: "פעולה זו תמחק את כל הקטגוריות המותאמות ותשחזר ברירת מחדל."
- **ניקוי הכל** (Clear all): removes all localStorage data. Nuclear option with double confirmation.

---

## Claude Code Prompt

Save this file as `SETTINGS.md` in the project folder. Tell Claude Code:

```
Read SETTINGS.md. Add a settings page with full category management:
1. Add the ⚙️ settings tab to the navigation
2. Build the category list with edit/delete/reorder
3. Add the "new category" form with emoji picker and color palette
4. Implement delete with reassignment dialog
5. Persist everything to localStorage
6. Make sure renaming/deleting categories updates all charts and mappings
```

---

## Definition of Done
- [ ] Settings tab appears in navigation
- [ ] All default categories listed with icon, name, merchant count
- [ ] Can add a new category with name, emoji, and color
- [ ] Can edit any existing category (name, icon, color)
- [ ] Can delete a category with reassignment option
- [ ] "אחר" category cannot be deleted
- [ ] Can reorder categories via drag and drop
- [ ] Changes persist in localStorage across refreshes
- [ ] Renaming a category updates charts, filters, and mapping view
- [ ] Deleting a category properly reassigns or uncategorizes merchants
- [ ] Reset buttons work with confirmation dialogs
- [ ] Validation prevents duplicate names and empty names
