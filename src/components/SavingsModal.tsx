import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search, Loader2 } from 'lucide-react'
import type { SavingsAccount, FundType } from '../types'
import { FUND_TYPE_LABELS, FUND_TYPE_COLORS, PROVIDERS } from '../hooks/useSavings'
import { searchFunds, fetchFullFundData, fundTypeToDataset } from '../utils/gemelnet'
import type { FundSearchResult, Dataset } from '../utils/gemelnet'

interface Props {
  account?: SavingsAccount | null
  onSave: (data: Partial<SavingsAccount>) => void
  onClose: () => void
}

const FUND_TYPES: FundType[] = ['gemel', 'hishtalmut', 'bituach', 'pensia', 'polisat', 'other']

function classificationToFundType(classification: string): FundType {
  if (/גמל/i.test(classification)) return 'gemel'
  if (/השתלמות/i.test(classification)) return 'hishtalmut'
  if (/ביטוח/i.test(classification)) return 'bituach'
  if (/פנסי/i.test(classification)) return 'pensia'
  if (/פוליס/i.test(classification)) return 'polisat'
  return 'other'
}

export function SavingsModal({ account, onSave, onClose }: Props) {
  const [fundType, setFundType] = useState<FundType>(account?.fundType ?? 'gemel')
  const [planName, setPlanName] = useState(account?.planName ?? '')
  const [provider, setProvider] = useState(account?.provider ?? '')
  const [fundCode, setFundCode] = useState(account?.fundCode ?? '')
  const [customProvider, setCustomProvider] = useState('')
  const [currentAmount, setCurrentAmount] = useState(account?.currentAmount ? String(account.currentAmount) : '')
  const [managementFee, setManagementFee] = useState(account?.managementFee != null ? String(account.managementFee) : '')
  const [yieldMonthly, setYieldMonthly] = useState(account?.yields.monthly != null ? String(account.yields.monthly) : '')
  const [yieldYtd, setYieldYtd] = useState(account?.yields.ytd != null ? String(account.yields.ytd) : '')
  const [yieldTwelve, setYieldTwelve] = useState(account?.yields.twelveMonth != null ? String(account.yields.twelveMonth) : '')
  const [yieldThree, setYieldThree] = useState(account?.yields.threeYear != null ? String(account.yields.threeYear) : '')
  const [notes, setNotes] = useState(account?.notes ?? '')
  const [color, setColor] = useState(account?.color ?? FUND_TYPE_COLORS[fundType])
  const [yieldHistory, setYieldHistory] = useState(account?.yieldHistory ?? [])
  const overlayRef = useRef<HTMLDivElement>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FundSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | undefined>(account?.fundDataset)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)

  const isEdit = !!account

  useEffect(() => {
    if (!account) setColor(FUND_TYPE_COLORS[fundType])
  }, [fundType, account])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Debounced fund search
  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (q.trim().length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    setSearching(true)
    searchTimerRef.current = setTimeout(async () => {
      try {
        // Search based on selected fund type, or both datasets
        const ds = fundTypeToDataset(fundType)
        const datasets = ds ? [ds] : undefined
        const results = await searchFunds(q.trim(), datasets)
        setSearchResults(results)
        setShowResults(true)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
  }, [])

  // On fund selection from search results
  async function handleSelectFund(fund: FundSearchResult) {
    setShowResults(false)
    setSearchQuery('')
    setFundCode(String(fund.fundId))
    setPlanName(fund.fundName)
    setProvider(fund.provider)
    setSelectedDataset(fund.dataset)
    const ft = classificationToFundType(fund.classification)
    setFundType(ft)
    setColor(FUND_TYPE_COLORS[ft])

    // Fetch full yield data
    setFetching(true)
    try {
      const data = await fetchFullFundData(fund.fundId, fund.dataset)
      if (data) {
        setYieldMonthly(data.yields.monthly != null ? String(data.yields.monthly) : '')
        setYieldYtd(data.yields.ytd != null ? String(data.yields.ytd) : '')
        setYieldTwelve(data.yields.twelveMonth != null ? String(data.yields.twelveMonth) : '')
        setYieldThree(data.yields.threeYear != null ? String(data.yields.threeYear) : '')
        setManagementFee(data.yields.managementFee != null ? String(data.yields.managementFee) : '')
        setYieldHistory(data.history)
      }
    } catch { /* user can still fill manually */ }
    finally { setFetching(false) }
  }

  function handleSave() {
    const resolvedProvider = provider === 'אחר' ? customProvider.trim() : provider
    const now = new Date().toISOString().slice(0, 10)
    onSave({
      fundType,
      planName: planName.trim(),
      name: FUND_TYPE_LABELS[fundType],
      provider: resolvedProvider,
      fundCode: fundCode.trim(),
      fundDataset: selectedDataset,
      currentAmount: parseFloat(currentAmount) || 0,
      lastUpdated: now,
      managementFee: managementFee ? parseFloat(managementFee) : null,
      yields: {
        monthly: yieldMonthly ? parseFloat(yieldMonthly) : null,
        ytd: yieldYtd ? parseFloat(yieldYtd) : null,
        twelveMonth: yieldTwelve ? parseFloat(yieldTwelve) : null,
        threeYear: yieldThree ? parseFloat(yieldThree) : null,
        lastYieldUpdate: now,
      },
      yieldHistory,
      notes,
      color,
    })
  }

  return (
    <div
      ref={overlayRef}
      style={s.overlay}
      onMouseDown={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div style={s.modal}>
        <div style={s.header}>
          <h3 style={s.title}>{isEdit ? 'ערוך תוכנית חיסכון' : 'הוסף תוכנית חיסכון'}</h3>
          <button style={s.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={s.body}>
          {/* GemelNet Search */}
          <div ref={searchWrapRef} style={s.searchWrap}>
            <label style={s.label}>חיפוש קופה לפי שם או קוד</label>
            <div style={s.searchInputWrap}>
              <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                style={s.searchInput}
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowResults(true) }}
                placeholder="למשל: מור גמל להשקעה, או קוד 12537"
              />
              {searching && <Loader2 size={14} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
            </div>
            {showResults && searchResults.length > 0 && (
              <div style={s.dropdown}>
                {searchResults.map(fund => (
                  <button
                    key={fund.fundId}
                    style={s.dropdownItem}
                    onClick={() => handleSelectFund(fund)}
                    onMouseDown={e => e.preventDefault()}
                  >
                    <span style={s.dropdownName}>{fund.fundName}</span>
                    <span style={s.dropdownMeta}>{fund.provider} · {fund.fundId} · {fund.dataset === 'pensia' ? 'פנסיה נט' : 'גמל נט'}</span>
                  </button>
                ))}
              </div>
            )}
            {showResults && searchResults.length === 0 && !searching && searchQuery.length >= 2 && (
              <div style={s.dropdown}>
                <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>לא נמצאו תוצאות</div>
              </div>
            )}
          </div>

          {fetching && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: 13, color: 'var(--accent)' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              מושך נתוני תשואה...
            </div>
          )}

          {/* Fund Type */}
          <label style={s.label}>סוג</label>
          <select style={s.select} value={fundType} onChange={e => setFundType(e.target.value as FundType)}>
            {FUND_TYPES.map(ft => (
              <option key={ft} value={ft}>{FUND_TYPE_LABELS[ft]}</option>
            ))}
          </select>

          {/* Plan Name */}
          <label style={s.label}>שם התוכנית</label>
          <input style={s.input} value={planName} onChange={e => setPlanName(e.target.value)} placeholder="למשל: מור גמל להשקעה - מניות" />

          {/* Provider */}
          <label style={s.label}>ספק</label>
          <select style={s.select} value={provider} onChange={e => setProvider(e.target.value)}>
            <option value="">בחר ספק</option>
            {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {provider === 'אחר' && (
            <input style={{ ...s.input, marginTop: 4 }} value={customProvider} onChange={e => setCustomProvider(e.target.value)} placeholder="שם הספק" />
          )}

          {/* Fund Code */}
          <label style={s.label}>קוד קופה (גמל נט)</label>
          <input style={s.input} value={fundCode} onChange={e => setFundCode(e.target.value)} placeholder="למשל: 12537 — לעדכון תשואות אוטומטי" />

          {/* Amount + Fee */}
          <div style={s.row}>
            <div style={s.col}>
              <label style={s.label}>סכום נוכחי (₪)</label>
              <input style={s.input} type="number" value={currentAmount} onChange={e => setCurrentAmount(e.target.value)} placeholder="0" />
            </div>
            <div style={s.col}>
              <label style={s.label}>דמי ניהול (%)</label>
              <input style={s.input} type="number" step="0.01" value={managementFee} onChange={e => setManagementFee(e.target.value)} placeholder="0.74" />
            </div>
          </div>

          {/* Yields */}
          <div style={s.separator}>תשואות {yieldHistory.length > 0 ? `(${yieldHistory.length} חודשים בהיסטוריה)` : '(אופציונלי)'}</div>
          <div style={s.row}>
            <div style={s.col}>
              <label style={s.label}>חודשי (%)</label>
              <input style={s.input} type="number" step="0.01" value={yieldMonthly} onChange={e => setYieldMonthly(e.target.value)} />
            </div>
            <div style={s.col}>
              <label style={s.label}>מתחילת שנה (%)</label>
              <input style={s.input} type="number" step="0.01" value={yieldYtd} onChange={e => setYieldYtd(e.target.value)} />
            </div>
          </div>
          <div style={s.row}>
            <div style={s.col}>
              <label style={s.label}>12 חודשים (%)</label>
              <input style={s.input} type="number" step="0.01" value={yieldTwelve} onChange={e => setYieldTwelve(e.target.value)} />
            </div>
            <div style={s.col}>
              <label style={s.label}>3 שנים (%)</label>
              <input style={s.input} type="number" step="0.01" value={yieldThree} onChange={e => setYieldThree(e.target.value)} />
            </div>
          </div>

          {/* Notes */}
          <label style={s.label}>הערות</label>
          <input style={s.input} value={notes} onChange={e => setNotes(e.target.value)} placeholder="הערות נוספות..." />

          {/* Color */}
          <label style={s.label}>צבע כרטיס</label>
          <div style={s.colorRow}>
            {Object.values(FUND_TYPE_COLORS).map(c => (
              <button
                key={c}
                style={{ ...s.colorSwatch, background: c, outline: color === c ? `2px solid ${c}` : '2px solid transparent', outlineOffset: 2 }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div style={s.footer}>
          <button className="btn-secondary" style={s.cancelBtn} onClick={onClose}>ביטול</button>
          <button style={s.saveBtn} onClick={handleSave}>שמירה</button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, direction: 'rtl' },
  modal: { background: 'var(--bg-surface)', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 12px', borderBottom: '1px solid var(--border)' },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 },
  body: { padding: '16px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 },
  input: { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' },
  select: { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' },
  row: { display: 'flex', gap: 12 },
  col: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  separator: { fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 4, marginTop: 8 },
  colorRow: { display: 'flex', gap: 8, marginTop: 4 },
  colorSwatch: { width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer' },
  footer: { display: 'flex', justifyContent: 'flex-start', gap: 8, padding: '12px 24px 20px', borderTop: '1px solid var(--border)' },
  cancelBtn: { padding: '8px 20px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' },
  saveBtn: { padding: '8px 24px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' },
  // Search styles
  searchWrap: { position: 'relative', marginBottom: 4 },
  searchInputWrap: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)' },
  searchInput: { flex: 1, border: 'none', background: 'none', fontSize: 14, fontFamily: 'inherit', color: 'var(--text-primary)', outline: 'none', minWidth: 0 },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: 220, overflowY: 'auto', zIndex: 10 },
  dropdownItem: { display: 'flex', flexDirection: 'column', gap: 2, width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit', transition: 'background 0.1s' },
  dropdownName: { fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' },
  dropdownMeta: { fontSize: 12, color: 'var(--text-muted)' },
}
