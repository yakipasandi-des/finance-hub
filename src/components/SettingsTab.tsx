import { useState, useRef } from 'react'
import { GripVertical, Pencil, Trash2, Download, Upload } from 'lucide-react'
import type { Transaction } from '../types'
import { Category, PALETTE_COLORS, EMOJI_PRESETS } from '../categories'
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
  | { type: 'add' }
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

  function handleExport() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      categories: localStorage.getItem('categories'),
      merchantCategoryMap: localStorage.getItem('merchantCategoryMap'),
      savings: localStorage.getItem('savings'),
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
        window.location.reload()
      } catch {
        setImportError('שגיאה בייבוא — ודא שהקובץ הוא קובץ גיבוי תקין')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // drag-and-drop state
  const dragIdx = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)

  // Stats per category
  function merchantCount(catId: string) {
    return Object.values(map).filter((v) => v === catId).length
  }
  function categorySpend(catId: string) {
    return allTransactions.filter((tx) => map[tx.merchant] === catId).reduce((s, t) => s + t.amount, 0)
  }

  // Drag handlers
  function onDragStart(idx: number) { dragIdx.current = idx }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOverIdx(idx) }
  function onDrop(idx: number) {
    const from = dragIdx.current
    if (from === null || from === idx) { setDragOverIdx(null); return }
    const next = [...sorted]
    const [moved] = next.splice(from, 1)
    next.splice(idx, 0, moved)
    reorderCategories(next)
    dragIdx.current = null
    setDragOverIdx(null)
  }

  // Delete handler — merges or uncategorizes merchants
  function handleDelete(catId: string, reassignTo: string | null) {
    // Find all merchants mapped to this category
    const merchants = Object.entries(map).filter(([, v]) => v === catId).map(([k]) => k)
    for (const merchant of merchants) {
      setMapping(merchant, reassignTo)
    }
    deleteCategory(catId)
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
      <h1 style={s.pageTitle}>הגדרות</h1>

      {/* ── Category Management ── */}
      <section style={s.section}>
        <div style={s.sectionHeader}>
          <h2 style={s.sectionTitle}>ניהול קטגוריות</h2>
          <button style={s.addBtn} onClick={() => setModal({ type: 'add' })}>
            + קטגוריה חדשה
          </button>
        </div>

        <div style={s.list}>
          {sorted.map((cat, idx) => {
            const count = merchantCount(cat.id)
            const spend = categorySpend(cat.id)
            const isDragOver = dragOverIdx === idx
            return (
              <div
                key={cat.id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDrop={() => onDrop(idx)}
                onDragEnd={() => setDragOverIdx(null)}
                style={{
                  ...s.row,
                  ...(isDragOver ? s.rowDragOver : {}),
                }}
              >
                <span style={s.dragHandle} title="גרור לשינוי סדר"><GripVertical size={16} strokeWidth={1.75} /></span>
                <span style={{ ...s.catIcon, color: cat.color }}><CategoryIcon icon={cat.icon} size={18} /></span>
                <div style={s.catInfo}>
                  <span style={s.catName}>{cat.name}</span>
                  <span style={s.catMeta}>
                    {count > 0
                      ? `${count} בתי עסק · ₪${Math.round(spend).toLocaleString('he-IL')}`
                      : 'אין בתי עסק ממופים'}
                  </span>
                </div>
                <div style={s.rowActions}>
                  <button style={s.iconBtn} onClick={() => setModal({ type: 'edit', category: cat })} title="עריכה"><Pencil size={14} strokeWidth={1.75} /></button>
                  <button
                    style={{ ...s.iconBtn, ...(cat.id === 'other' ? s.iconBtnDisabled : {}) }}
                    onClick={() => cat.id !== 'other' && setModal({ type: 'delete', category: cat })}
                    title={cat.id === 'other' ? 'לא ניתן למחוק קטגוריית ברירת מחדל' : 'מחיקה'}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
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
          onSubmit={(name, icon, color) => { addCategory(name, icon, color); setModal(null) }}
          onCancel={() => setModal(null)}
        />
      )}

      {modal?.type === 'edit' && (
        <CategoryFormModal
          mode="edit"
          initial={modal.category}
          existingNames={categories.filter((c) => c.id !== modal.category.id).map((c) => c.name)}
          usedColors={[]}
          otherCategories={categories.filter((c) => c.id !== modal.category.id)}
          onSubmit={(name, icon, color) => { updateCategory(modal.category.id, { name, icon, color }); setModal(null) }}
          onMerge={(toId) => handleMerge(modal.category.id, toId)}
          onCancel={() => setModal(null)}
        />
      )}

      {modal?.type === 'delete' && (
        <DeleteDialog
          category={modal.category}
          merchantCount={merchantCount(modal.category.id)}
          otherCategories={categories.filter((c) => c.id !== modal.category.id)}
          onConfirm={(reassignTo) => handleDelete(modal.category.id, reassignTo)}
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
  otherCategories?: Category[]
  onSubmit: (name: string, icon: string, color: string) => void
  onMerge?: (toId: string) => void
  onCancel: () => void
}

function CategoryFormModal({
  mode, initial, existingNames, usedColors,
  otherCategories = [], onSubmit, onMerge, onCancel,
}: CategoryFormModalProps) {
  const firstUnused = PALETTE_COLORS.find((c) => !usedColors.includes(c)) ?? PALETTE_COLORS[0]
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? 'Package')
  const [color, setColor] = useState(initial?.color ?? firstUnused)
  const [mergeTarget, setMergeTarget] = useState('')
  const [nameError, setNameError] = useState('')

  function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) { setNameError('שם הקטגוריה נדרש'); return }
    if (existingNames.map((n) => n.toLowerCase()).includes(trimmed.toLowerCase())) {
      setNameError('שם זה כבר קיים'); return
    }
    onSubmit(trimmed, icon, color)
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
  category, merchantCount, otherCategories, onConfirm, onCancel,
}: {
  category: Category
  merchantCount: number
  otherCategories: Category[]
  onConfirm: (reassignTo: string | null) => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<'reassign' | 'uncat'>('uncat')
  const [target, setTarget] = useState(otherCategories[0]?.id ?? '')

  return (
    <Overlay onClose={onCancel}>
      <h3 style={s.modalTitle}>מחיקת קטגוריה</h3>
      <p style={s.deleteDesc}>
        למחוק את <strong>"{category.name}"</strong>?
      </p>
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
          onClick={() => onConfirm(mode === 'reassign' ? target : null)}
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
  page: { display: 'flex', flexDirection: 'column', gap: '24px' },
  pageTitle: { margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', direction: 'rtl' },
  section: { background: 'var(--bg-surface)', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', direction: 'rtl' },
  sectionTitle: { margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' },
  addBtn: { padding: '7px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  list: { display: 'flex', flexDirection: 'column', gap: '4px' },
  row: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 12px', borderRadius: '10px',
    background: 'var(--bg-primary)', direction: 'rtl',
    transition: 'background 0.1s',
    cursor: 'grab',
  },
  rowDragOver: { background: '#ede9f8', outline: '2px dashed var(--accent)' },
  dragHandle: { fontSize: '16px', color: 'var(--text-faint)', cursor: 'grab', flexShrink: 0 },
  catIcon: { fontSize: '20px', flexShrink: 0 },
  catInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' },
  catName: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' },
  catMeta: { fontSize: '11px', color: 'var(--text-faint)' },
  rowActions: { display: 'flex', gap: '4px', flexShrink: 0 },
  iconBtn: { background: 'none', border: 'none', fontSize: '15px', cursor: 'pointer', padding: '4px', borderRadius: '6px', lineHeight: 1 },
  iconBtnDisabled: { opacity: 0.3, cursor: 'not-allowed' },
  dangerList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  dangerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)', direction: 'rtl', gap: '16px' },
  dangerBtn: { padding: '6px 16px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },
  dangerBtnRed: { borderColor: '#d9708040', color: 'var(--red)', background: '#fce8ef' },
  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 },
  modal: { background: 'var(--bg-surface)', borderRadius: '16px', padding: '28px', width: '360px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '12px', direction: 'rtl', maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' },
  fieldLabel: { fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' },
  input: { padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: 'inherit', fontSize: '14px', direction: 'rtl', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box' },
  fieldError: { margin: '-6px 0 0', fontSize: '12px', color: 'var(--red)' },
  emojiPreview: { fontSize: '32px', textAlign: 'center', padding: '8px', background: 'var(--bg-primary)', borderRadius: '8px' },
  emojiGrid: { display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' },
  emojiBtn: { fontSize: '18px', padding: '4px', border: '1px solid transparent', borderRadius: '6px', background: 'none', cursor: 'pointer', textAlign: 'center' },
  emojiBtnActive: { border: '1px solid var(--accent)', background: '#ede9f8' },
  colorGrid: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  colorSwatch: { width: '28px', height: '28px', borderRadius: '50%', border: '2px solid transparent', cursor: 'pointer', flexShrink: 0 },
  colorSwatchActive: { border: '3px solid #2d2640', outline: '2px solid white', outlineOffset: '-4px' },
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
  backupDesc: { margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)' },
  backupRow: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  backupItem: { flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '4px', padding: '16px', background: 'var(--bg-primary)', borderRadius: '12px' },
  backupLabel: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' },
  backupMeta: { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' },
  backupBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', padding: '7px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  importError: { margin: '8px 0 0', fontSize: '13px', color: 'var(--red)' },
}
