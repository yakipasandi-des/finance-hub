import { useState, useRef, useEffect } from 'react'
import { GripVertical, Pencil, Trash2, Download, Upload, ChevronDown, ChevronLeft, Eye, EyeOff, Key } from 'lucide-react'
import type { Transaction } from '../types'
import { Category, PALETTE_COLORS, EMOJI_PRESETS, getParentCategories, getChildCategories, buildCategoryTree } from '../categories'
import { CategoryIcon } from '../icons'
import { useCategories } from '../context/CategoriesContext'

interface SettingsTabProps {
  allTransactions: Transaction[]
  map: Record<string, string>
  setMapping: (merchant: string, categoryId: string | null) => void
  onClearAll: () => void
}

type Modal =
  | null
  | { type: 'add'; parentId?: string }
  | { type: 'edit'; category: Category }
  | { type: 'delete'; category: Category }

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function SettingsTab({ allTransactions, map, setMapping, onClearAll }: SettingsTabProps) {
  const { categories, addCategory, updateCategory, deleteCategory, reorderCategories, mergeInto, resetToDefaults } = useCategories()
  const [modal, setModal] = useState<Modal>(null)
  const [confirmReset, setConfirmReset] = useState<'mappings' | 'categories' | 'all' | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const [expandedParent, setExpandedParent] = useState<string | null>(null)

  // Claude API key
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic-api-key') ?? '')
  const [showKey, setShowKey] = useState(false)
  const [keySaved, setKeySaved] = useState(false)

  // Claude model
  const [model, setModel] = useState(() => localStorage.getItem('anthropic-model') || 'claude-haiku-4-5')

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setModel(val)
    localStorage.setItem('anthropic-model', val)
  }

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('anthropic-api-key', apiKey.trim())
    } else {
      localStorage.removeItem('anthropic-api-key')
    }
    setKeySaved(true)
    setTimeout(() => setKeySaved(false), 2000)
  }

  function handleExport() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      categories: localStorage.getItem('categories'),
      merchantCategoryMap: localStorage.getItem('merchantCategoryMap'),
      savings: localStorage.getItem('savings'),
      budgets: localStorage.getItem('budgets'),
      manualEntries: localStorage.getItem('manualEntries'),
      bankEntries: localStorage.getItem('bankEntries'),
      bankSettings: localStorage.getItem('bankSettings'),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finance-hub-backup-${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (!data.version) throw new Error('קובץ לא תקין')
        if (data.categories) localStorage.setItem('categories', data.categories)
        if (data.merchantCategoryMap) localStorage.setItem('merchantCategoryMap', data.merchantCategoryMap)
        if (data.savings) localStorage.setItem('savings', data.savings)
        if (data.budgets) localStorage.setItem('budgets', data.budgets)
        if (data.manualEntries) localStorage.setItem('manualEntries', data.manualEntries)
        if (data.bankEntries) localStorage.setItem('bankEntries', data.bankEntries)
        if (data.bankSettings) localStorage.setItem('bankSettings', data.bankSettings)
        window.location.reload()
      } catch {
        setImportError('שגיאה בייבוא — ודא שהקובץ הוא קובץ גיבוי תקין')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Build category tree for hierarchical display
  const tree = buildCategoryTree(categories)

  // Stats per category (with optional children aggregation)
  function merchantCount(catId: string, includeChildren = false) {
    let count = Object.values(map).filter((v) => v === catId).length
    if (includeChildren) {
      for (const child of getChildCategories(catId, categories)) {
        count += Object.values(map).filter((v) => v === child.id).length
      }
    }
    return count
  }
  function categorySpend(catId: string, includeChildren = false) {
    let spend = allTransactions.filter((tx) => map[tx.merchant] === catId).reduce((s, t) => s + t.amount, 0)
    if (includeChildren) {
      for (const child of getChildCategories(catId, categories)) {
        spend += allTransactions.filter((tx) => map[tx.merchant] === child.id).reduce((s, t) => s + t.amount, 0)
      }
    }
    return spend
  }

  function toggleCollapse(parentId: string) {
    setExpandedParent((prev) => prev === parentId ? null : parentId)
  }

  // drag-and-drop state — operates on flat list of parents only
  const dragIdx = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // Drag handlers for parent reordering
  function onDragStartParent(idx: number) { dragIdx.current = idx }
  function onDragOverParent(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOverIdx(idx) }
  function onDropParent(idx: number) {
    const from = dragIdx.current
    if (from === null || from === idx) { setDragOverIdx(null); return }
    const parents = tree.map((n) => n.parent)
    const [moved] = parents.splice(from, 1)
    parents.splice(idx, 0, moved)
    // Rebuild full list: parents in new order with their children
    const flat: Category[] = []
    for (const p of parents) {
      flat.push(p)
      flat.push(...getChildCategories(p.id, categories))
    }
    reorderCategories(flat)
    dragIdx.current = null
    setDragOverIdx(null)
  }

  // Delete handler — merges or uncategorizes merchants
  function handleDelete(catId: string, reassignTo: string | null, promoteChildren?: boolean) {
    // Find all merchants mapped to this category (and children if not promoting)
    const idsToReassign = [catId]
    if (!promoteChildren) {
      for (const child of getChildCategories(catId, categories)) {
        idsToReassign.push(child.id)
      }
    }
    for (const id of idsToReassign) {
      const merchants = Object.entries(map).filter(([, v]) => v === id).map(([k]) => k)
      for (const merchant of merchants) {
        setMapping(merchant, reassignTo)
      }
    }
    deleteCategory(catId, promoteChildren)
    setModal(null)
  }

  // Merge handler
  function handleMerge(fromId: string, toId: string) {
    mergeInto(fromId, toId, (from, to) => {
      const merchants = Object.entries(map).filter(([, v]) => v === from).map(([k]) => k)
      for (const merchant of merchants) setMapping(merchant, to)
    })
    setModal(null)
  }

  return (
    <div style={s.page}>
      {/* ── Category Management ── */}
      <section style={s.section}>
        <div style={s.sectionHeader}>
          <h2 style={s.sectionTitle}>ניהול קטגוריות</h2>
          <button style={s.addBtn} onClick={() => setModal({ type: 'add' })}>
            + קטגוריה חדשה
          </button>
        </div>

        <div style={s.list}>
          {tree.map((node, parentIdx) => {
            const { parent, children } = node
            const hasChildren = children.length > 0
            const isCollapsed = expandedParent !== parent.id
            const count = merchantCount(parent.id, hasChildren)
            const spend = categorySpend(parent.id, hasChildren)
            const isDragOver = dragOverIdx === parentIdx

            return (
              <div key={parent.id}>
                {/* Parent row */}
                <div
                  draggable
                  onDragStart={() => onDragStartParent(parentIdx)}
                  onDragOver={(e) => onDragOverParent(e, parentIdx)}
                  onDrop={() => onDropParent(parentIdx)}
                  onDragEnd={() => setDragOverIdx(null)}
                  style={{
                    ...s.row,
                    ...(isDragOver ? s.rowDragOver : {}),
                  }}
                >
                  <span style={s.dragHandle} title="גרור לשינוי סדר"><GripVertical size={16} strokeWidth={1.75} /></span>
                  {hasChildren && (
                    <button style={s.collapseBtn} onClick={() => toggleCollapse(parent.id)} title={isCollapsed ? 'הרחב' : 'כווץ'}>
                      {isCollapsed ? <ChevronLeft size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
                    </button>
                  )}
                  <span style={{ ...s.catIcon, color: parent.color }}><CategoryIcon icon={parent.icon} size={18} /></span>
                  <div style={s.catInfo}>
                    <span style={s.catName}>{parent.name}</span>
                    <span style={s.catMeta}>
                      {count > 0
                        ? `${count} בתי עסק · ₪${Math.round(spend).toLocaleString('he-IL')}`
                        : 'אין בתי עסק ממופים'}
                    </span>
                  </div>
                  <div style={s.rowActions}>
                    <button style={s.iconBtn} onClick={() => setModal({ type: 'add', parentId: parent.id })} title="הוסף תת-קטגוריה">+</button>
                    <button style={s.iconBtn} onClick={() => setModal({ type: 'edit', category: parent })} title="עריכה"><Pencil size={14} strokeWidth={1.75} /></button>
                    <button
                      style={{ ...s.iconBtn, ...(parent.id === 'other' ? s.iconBtnDisabled : {}) }}
                      onClick={() => parent.id !== 'other' && setModal({ type: 'delete', category: parent })}
                      title={parent.id === 'other' ? 'לא ניתן למחוק קטגוריית ברירת מחדל' : 'מחיקה'}
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>

                {/* Children rows */}
                {hasChildren && !isCollapsed && children.map((child) => {
                  const childCount = merchantCount(child.id)
                  const childSpend = categorySpend(child.id)
                  return (
                    <div
                      key={child.id}
                      style={{
                        ...s.row,
                        paddingRight: 44,
                        borderRight: `3px solid ${parent.color}40`,
                        background: 'var(--bg-surface)',
                      }}
                    >
                      <span style={{ ...s.catIcon, color: child.color }}><CategoryIcon icon={child.icon} size={16} /></span>
                      <div style={s.catInfo}>
                        <span style={{ ...s.catName, fontSize: '13px' }}>{child.name}</span>
                        <span style={s.catMeta}>
                          {childCount > 0
                            ? `${childCount} בתי עסק · ₪${Math.round(childSpend).toLocaleString('he-IL')}`
                            : 'אין בתי עסק ממופים'}
                        </span>
                      </div>
                      <div style={s.rowActions}>
                        <button style={s.iconBtn} onClick={() => setModal({ type: 'edit', category: child })} title="עריכה"><Pencil size={14} strokeWidth={1.75} /></button>
                        <button style={s.iconBtn} onClick={() => setModal({ type: 'delete', category: child })} title="מחיקה"><Trash2 size={14} strokeWidth={1.75} /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Claude API ── */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}><Key size={16} strokeWidth={1.75} style={{ verticalAlign: 'middle', marginLeft: 6 }} />Claude API</h2>
        <p style={s.backupDesc}>הזן מפתח API של Anthropic כדי להפעיל תובנות חכמות, סיווג אוטומטי ושאילתות בשפה טבעית. המפתח נשמר בדפדפן בלבד.</p>
        <div style={s.apiKeyRow}>
          <div style={s.apiKeyInputWrap}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              style={s.apiKeyInput}
              dir="ltr"
            />
            <button
              style={s.apiKeyToggle}
              onClick={() => setShowKey(!showKey)}
              title={showKey ? 'הסתר' : 'הצג'}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button style={s.backupBtn} onClick={handleSaveKey}>
            {keySaved ? '✓ נשמר' : 'שמור'}
          </button>
        </div>
        <div style={s.apiModelRow}>
          <label style={s.backupLabel}>מודל</label>
          <select value={model} onChange={handleModelChange} style={s.apiSelect}>
            <option value="claude-haiku-4-5">Haiku 4.5 (מהיר וחסכוני)</option>
            <option value="claude-sonnet-4-6">Sonnet 4.6 (מאוזן)</option>
            <option value="claude-opus-4-6">Opus 4.6 (מתקדם)</option>
          </select>
        </div>
        {apiKey && !apiKey.startsWith('sk-ant-') && (
          <p style={s.importError}>מפתח API צריך להתחיל ב-sk-ant-</p>
        )}
      </section>

      {/* ── Backup & Restore ── */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>גיבוי ושחזור</h2>
        <p style={s.backupDesc}>ייצא את כל ההגדרות, הקטגוריות, המיפויים והחסכונות לקובץ. ניתן לייבא אותו בכל דפדפן או מכשיר.</p>
        <div style={s.backupRow}>
          <div style={s.backupItem}>
            <span style={s.backupLabel}>ייצוא נתונים</span>
            <span style={s.backupMeta}>הורד קובץ גיבוי של כל ההגדרות</span>
            <button style={s.backupBtn} onClick={handleExport}>
              <Download size={14} strokeWidth={1.75} /> ייצא
            </button>
          </div>
          <div style={s.backupItem}>
            <span style={s.backupLabel}>ייבוא נתונים</span>
            <span style={s.backupMeta}>שחזר מקובץ גיבוי — יחליף את הנתונים הנוכחיים</span>
            <button style={s.backupBtn} onClick={() => importRef.current?.click()}>
              <Upload size={14} strokeWidth={1.75} /> ייבא
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </div>
        </div>
        {importError && <p style={s.importError}>{importError}</p>}
      </section>

      {/* ── General Settings ── */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>ניהול נתונים</h2>
        <div style={s.dangerList}>
          <DangerRow
            label="איפוס מיפויים"
            description="מוחק את כל שיוכי בתי העסק לקטגוריות"
            btnLabel="איפוס מיפויים"
            onConfirm={() => setConfirmReset('mappings')}
          />
          <DangerRow
            label="איפוס קטגוריות"
            description="משחזר את קטגוריות ברירת המחדל ומוחק קטגוריות מותאמות"
            btnLabel="איפוס קטגוריות"
            onConfirm={() => setConfirmReset('categories')}
          />
          <DangerRow
            label="ניקוי הכל"
            description="מוחק את כל הנתונים — קטגוריות, מיפויים וסינונים"
            btnLabel="ניקוי הכל"
            danger
            onConfirm={() => setConfirmReset('all')}
          />
        </div>
      </section>

      {/* ── Modals ── */}
      {modal?.type === 'add' && (
        <CategoryFormModal
          mode="add"
          existingNames={categories.map((c) => c.name)}
          usedColors={categories.map((c) => c.color)}
          parentCategories={getParentCategories(categories)}
          initialParentId={modal.parentId}
          onSubmit={(name, icon, color, parentId) => { addCategory(name, icon, color, parentId); setModal(null) }}
          onCancel={() => setModal(null)}
        />
      )}

      {modal?.type === 'edit' && (
        <CategoryFormModal
          mode="edit"
          initial={modal.category}
          existingNames={categories.filter((c) => c.id !== modal.category.id).map((c) => c.name)}
          usedColors={[]}
          parentCategories={getParentCategories(categories).filter((c) => c.id !== modal.category.id)}
          hasChildren={getChildCategories(modal.category.id, categories).length > 0}
          otherCategories={categories.filter((c) => c.id !== modal.category.id)}
          onSubmit={(name, icon, color, parentId) => { updateCategory(modal.category.id, { name, icon, color, parentId }); setModal(null) }}
          onMerge={(toId) => handleMerge(modal.category.id, toId)}
          onCancel={() => setModal(null)}
        />
      )}

      {modal?.type === 'delete' && (
        <DeleteDialog
          category={modal.category}
          merchantCount={merchantCount(modal.category.id)}
          childCount={getChildCategories(modal.category.id, categories).length}
          otherCategories={categories.filter((c) => c.id !== modal.category.id && !c.parentId)}
          onConfirm={(reassignTo, promoteChildren) => handleDelete(modal.category.id, reassignTo, promoteChildren)}
          onCancel={() => setModal(null)}
        />
      )}

      {/* ── Confirm reset dialogs ── */}
      {confirmReset && (
        <ConfirmDialog
          message={
            confirmReset === 'mappings' ? 'לאפס את כל שיוכי בתי העסק לקטגוריות?' :
            confirmReset === 'categories' ? 'לשחזר קטגוריות ברירת מחדל? קטגוריות מותאמות יימחקו.' :
            'למחוק את כל הנתונים? פעולה זו בלתי הפיכה.'
          }
          confirmLabel={confirmReset === 'all' ? 'מחק הכל' : 'אפס'}
          onConfirm={() => {
            if (confirmReset === 'mappings') {
              Object.keys(map).forEach((m) => setMapping(m, null))
            } else if (confirmReset === 'categories') {
              resetToDefaults()
            } else {
              onClearAll()
            }
            setConfirmReset(null)
          }}
          onCancel={() => setConfirmReset(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CategoryFormModal
// ---------------------------------------------------------------------------
interface CategoryFormModalProps {
  mode: 'add' | 'edit'
  initial?: Category
  existingNames: string[]
  usedColors: string[]
  parentCategories?: Category[]
  initialParentId?: string
  hasChildren?: boolean
  otherCategories?: Category[]
  onSubmit: (name: string, icon: string, color: string, parentId?: string) => void
  onMerge?: (toId: string) => void
  onCancel: () => void
}

function CategoryFormModal({
  mode, initial, existingNames, usedColors,
  parentCategories = [], initialParentId, hasChildren,
  otherCategories = [], onSubmit, onMerge, onCancel,
}: CategoryFormModalProps) {
  const firstUnused = PALETTE_COLORS.find((c) => !usedColors.includes(c)) ?? PALETTE_COLORS[0]
  const defaultParentId = initialParentId ?? initial?.parentId ?? ''
  const parentCat = parentCategories.find((c) => c.id === defaultParentId)
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? parentCat?.icon ?? 'Package')
  const [color, setColor] = useState(initial?.color ?? parentCat?.color ?? firstUnused)
  const [parentId, setParentId] = useState(defaultParentId)
  const [mergeTarget, setMergeTarget] = useState('')
  const [nameError, setNameError] = useState('')

  function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) { setNameError('שם הקטגוריה נדרש'); return }
    if (existingNames.map((n) => n.toLowerCase()).includes(trimmed.toLowerCase())) {
      setNameError('שם זה כבר קיים'); return
    }
    onSubmit(trimmed, icon, color, parentId || undefined)
  }

  return (
    <Overlay onClose={onCancel}>
      <h3 style={s.modalTitle}>{mode === 'add' ? 'קטגוריה חדשה' : `עריכת "${initial?.name}"`}</h3>

      {/* Name */}
      <label style={s.fieldLabel}>שם</label>
      <input
        value={name}
        onChange={(e) => { setName(e.target.value); setNameError('') }}
        placeholder="שם הקטגוריה..."
        style={{ ...s.input, ...(nameError ? { borderColor: 'var(--red)' } : {}) }}
        autoFocus
      />
      {nameError && <p style={s.fieldError}>{nameError}</p>}

      {/* Parent category selector */}
      {parentCategories.length > 0 && !hasChildren && (
        <>
          <label style={s.fieldLabel}>קטגוריה אב</label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            style={s.input}
          >
            <option value="">ללא (קטגוריה ראשית)</option>
            {parentCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </>
      )}
      {hasChildren && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
          לא ניתן להפוך לתת-קטגוריה — יש תת-קטגוריות קיימות
        </p>
      )}

      {/* Icon picker */}
      <label style={s.fieldLabel}>אייקון</label>
      <div style={s.emojiPreview}><CategoryIcon icon={icon} size={28} /></div>
      <div style={s.emojiGrid}>
        {EMOJI_PRESETS.map((name) => (
          <button
            key={name}
            onClick={() => setIcon(name)}
            style={{ ...s.emojiBtn, ...(icon === name ? s.emojiBtnActive : {}) }}
            title={name}
          >
            <CategoryIcon icon={name} size={16} />
          </button>
        ))}
      </div>

      {/* Color */}
      <label style={s.fieldLabel}>צבע</label>
      <div style={s.colorGrid}>
        {PALETTE_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              ...s.colorSwatch,
              background: c,
              ...(color === c ? s.colorSwatchActive : {}),
            }}
          />
        ))}
      </div>

      {/* Merge (edit only) */}
      {mode === 'edit' && onMerge && otherCategories.length > 0 && (
        <div style={s.mergeRow}>
          <span style={s.mergeLabel}>מזג קטגוריה אחרת לתוך זו:</span>
          <select
            value={mergeTarget}
            onChange={(e) => setMergeTarget(e.target.value)}
            style={s.mergeSelect}
          >
            <option value="">בחר...</option>
            {otherCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {mergeTarget && (
            <button
              style={s.mergeConfirmBtn}
              onClick={() => onMerge(mergeTarget)}
            >
              מזג
            </button>
          )}
        </div>
      )}

      <div style={s.modalActions}>
        <button style={s.cancelBtn} onClick={onCancel}>ביטול</button>
        <button style={s.submitBtn} onClick={handleSubmit}>שמירה</button>
      </div>
    </Overlay>
  )
}

// ---------------------------------------------------------------------------
// DeleteDialog
// ---------------------------------------------------------------------------
function DeleteDialog({
  category, merchantCount, childCount, otherCategories, onConfirm, onCancel,
}: {
  category: Category
  merchantCount: number
  childCount: number
  otherCategories: Category[]
  onConfirm: (reassignTo: string | null, promoteChildren?: boolean) => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<'reassign' | 'uncat'>('uncat')
  const [target, setTarget] = useState(otherCategories[0]?.id ?? '')
  const [childAction, setChildAction] = useState<'delete' | 'promote'>('promote')

  return (
    <Overlay onClose={onCancel}>
      <h3 style={s.modalTitle}>מחיקת קטגוריה</h3>
      <p style={s.deleteDesc}>
        למחוק את <strong>"{category.name}"</strong>?
      </p>
      {childCount > 0 && (
        <>
          <p style={s.deleteCount}>{childCount} תת-קטגוריות שייכות לקטגוריה זו. מה לעשות עמן?</p>
          <div style={s.radioGroup}>
            <label style={s.radioRow}>
              <input type="radio" checked={childAction === 'promote'} onChange={() => setChildAction('promote')} />
              <span>הפוך לקטגוריות ראשיות</span>
            </label>
            <label style={s.radioRow}>
              <input type="radio" checked={childAction === 'delete'} onChange={() => setChildAction('delete')} />
              <span>מחק גם אותן</span>
            </label>
          </div>
        </>
      )}
      {merchantCount > 0 && (
        <>
          <p style={s.deleteCount}>{merchantCount} בתי עסק ממופים לקטגוריה זו. מה לעשות עמם?</p>
          <div style={s.radioGroup}>
            <label style={s.radioRow}>
              <input type="radio" checked={mode === 'uncat'} onChange={() => setMode('uncat')} />
              <span>סמן כ"ללא קטגוריה"</span>
            </label>
            <label style={s.radioRow}>
              <input type="radio" checked={mode === 'reassign'} onChange={() => setMode('reassign')} />
              <span>העבר ל:</span>
              <select
                value={target}
                onChange={(e) => { setTarget(e.target.value); setMode('reassign') }}
                style={s.reassignSelect}
              >
                {otherCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
      <div style={s.modalActions}>
        <button style={s.cancelBtn} onClick={onCancel}>ביטול</button>
        <button
          style={{ ...s.submitBtn, background: 'var(--red)' }}
          onClick={() => onConfirm(mode === 'reassign' ? target : null, childAction === 'promote')}
        >
          מחק
        </button>
      </div>
    </Overlay>
  )
}

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------
function ConfirmDialog({
  message, confirmLabel, onConfirm, onCancel,
}: {
  message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Overlay onClose={onCancel}>
      <p style={{ ...s.deleteDesc, marginTop: 0 }}>{message}</p>
      <div style={s.modalActions}>
        <button style={s.cancelBtn} onClick={onCancel}>ביטול</button>
        <button style={{ ...s.submitBtn, background: 'var(--red)' }} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Overlay>
  )
}

// ---------------------------------------------------------------------------
// DangerRow
// ---------------------------------------------------------------------------
function DangerRow({
  label, description, btnLabel, danger, onConfirm,
}: {
  label: string; description: string; btnLabel: string; danger?: boolean; onConfirm: () => void
}) {
  return (
    <div style={s.dangerRow}>
      <div>
        <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: danger ? 'var(--red)' : 'var(--text-primary)' }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{description}</p>
      </div>
      <button style={{ ...s.dangerBtn, ...(danger ? s.dangerBtnRed : {}) }} onClick={onConfirm}>{btnLabel}</button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overlay wrapper
// ---------------------------------------------------------------------------
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={s.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.modal}>
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },
  section: { background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', padding: '24px 28px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', direction: 'rtl' },
  sectionTitle: { margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' },
  addBtn: { padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s ease' },
  list: { display: 'flex', flexDirection: 'column', gap: '4px' },
  row: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 12px', borderRadius: 'var(--radius-sm)',
    direction: 'rtl',
    transition: 'background 0.1s',
    cursor: 'grab',
    borderBottom: '1px solid var(--border)',
  },
  rowDragOver: { background: 'var(--accent-fill)', outline: '2px dashed var(--accent)' },
  dragHandle: { fontSize: '16px', color: 'var(--text-faint)', cursor: 'grab', flexShrink: 0 },
  collapseBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-faint)', lineHeight: 1, flexShrink: 0, display: 'flex', alignItems: 'center' },
  catIcon: { fontSize: '20px', flexShrink: 0 },
  catInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' },
  catName: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' },
  catMeta: { fontSize: '11px', color: 'var(--text-faint)' },
  rowActions: { display: 'flex', gap: '4px', flexShrink: 0 },
  iconBtn: { background: 'none', border: 'none', fontSize: '15px', cursor: 'pointer', padding: '4px', borderRadius: '6px', lineHeight: 1, color: 'var(--text-muted)' },
  iconBtnDisabled: { opacity: 0.3, cursor: 'not-allowed' },
  dangerList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  dangerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)', direction: 'rtl', gap: '16px' },
  dangerBtn: { padding: '6px 16px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },
  dangerBtnRed: { borderColor: 'var(--red)', color: 'var(--red)', background: 'rgba(239, 68, 68, 0.06)' },
  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 },
  modal: { background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', padding: '28px', width: '360px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '14px', direction: 'rtl', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' },
  modalTitle: { margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' },
  fieldLabel: { fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' },
  input: { padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: 'inherit', fontSize: '14px', direction: 'rtl', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box' },
  fieldError: { margin: '-6px 0 0', fontSize: '12px', color: 'var(--red)' },
  emojiPreview: { fontSize: '32px', textAlign: 'center', padding: '8px', background: 'var(--bg-primary)', borderRadius: '8px' },
  emojiGrid: { display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' },
  emojiBtn: { fontSize: '18px', padding: '4px', border: '1px solid transparent', borderRadius: '6px', background: 'none', cursor: 'pointer', textAlign: 'center' },
  emojiBtnActive: { border: '1px solid var(--accent)', background: 'var(--accent-fill)' },
  colorGrid: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  colorSwatch: { width: '28px', height: '28px', borderRadius: '50%', border: '2px solid transparent', cursor: 'pointer', flexShrink: 0 },
  colorSwatchActive: { border: '3px solid var(--text-primary)', outline: '2px solid var(--bg-surface)', outlineOffset: '-4px' },
  mergeRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '8px', flexWrap: 'wrap' },
  mergeLabel: { fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' },
  mergeSelect: { flex: 1, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'inherit', fontSize: '12px', background: 'var(--bg-surface)', direction: 'rtl' },
  mergeConfirmBtn: { padding: '4px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  modalActions: { display: 'flex', gap: '8px', justifyContent: 'flex-start', marginTop: '4px' },
  cancelBtn: { padding: '8px 20px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: '14px', cursor: 'pointer' },
  submitBtn: { padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  deleteDesc: { margin: '0 0 4px', fontSize: '15px', color: 'var(--text-primary)' },
  deleteCount: { margin: 0, fontSize: '13px', color: 'var(--text-muted)' },
  radioGroup: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0' },
  radioRow: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' },
  reassignSelect: { padding: '3px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px', background: 'var(--bg-surface)', direction: 'rtl' },
  apiKeyRow: { display: 'flex', gap: '10px', alignItems: 'center' },
  apiKeyInputWrap: { position: 'relative', flex: 1, maxWidth: 400 },
  apiKeyInput: { width: '100%', boxSizing: 'border-box', padding: '9px 40px 9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' },
  apiKeyToggle: { position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  backupDesc: { margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)' },
  backupRow: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  backupItem: { flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '4px', padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' },
  backupLabel: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' },
  backupMeta: { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' },
  backupBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', padding: '7px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  importError: { margin: '8px 0 0', fontSize: '13px', color: 'var(--red)' },
  apiModelRow: { display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' },
  apiSelect: { padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: 'inherit', fontSize: '13px', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', direction: 'rtl' },
}
