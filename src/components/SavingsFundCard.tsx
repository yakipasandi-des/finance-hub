import { useState } from 'react'
import { Loader2, Pencil, Trash2, RefreshCw } from 'lucide-react'
import type { SavingsAccount, InflationData } from '../types'
import { fetchFullFundData, fundTypeToDataset } from '../utils/gemelnet'

interface Props {
  account: SavingsAccount
  inflation: InflationData
  onEdit: () => void
  onDelete: () => void
  onUpdateAmount: (amount: number) => void
  onUpdateYield: (field: 'monthly' | 'ytd' | 'twelveMonth' | 'threeYear', value: number | null) => void
  onRefreshYields?: (data: { yields: SavingsAccount['yields']; yieldHistory: SavingsAccount['yieldHistory'] }) => void
}

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

function fmtPct(n: number | null): string {
  if (n == null) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function pctColor(n: number | null): string {
  if (n == null) return 'var(--text-muted)'
  if (n > 0.5) return 'var(--green)'
  if (n < -0.5) return 'var(--red)'
  return 'var(--amber, #b45309)'
}

// removed realYieldIndicator — color alone conveys positive/negative

function Sparkline({ data, color }: { data: { month: string; yield: number }[]; color: string }) {
  if (data.length < 2) return null
  const w = 150, h = 50, pad = 4
  const values = data.map(d => d.yield)
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return { x, y }
  })
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const last = points[points.length - 1]
  const avgPositive = values.reduce((s, v) => s + v, 0) / values.length > 0
  const lineColor = avgPositive ? '#10b981' : '#e11d48'
  const gradientId = `spark-grad-${color.replace('#', '')}`

  // Closed path for the gradient fill area
  const first = points[0]
  const areaD = `${pathD} L${last.x},${h} L${first.x},${h} Z`

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity={0.12} />
          <stop offset="100%" stopColor={lineColor} stopOpacity={0.01} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={3} fill={lineColor} stroke="#fff" strokeWidth={1.5} />
    </svg>
  )
}

type YieldPeriod = 'monthly' | 'ytd' | 'twelveMonth'
const PERIOD_LABELS: Record<YieldPeriod, string> = { monthly: 'חודשי', ytd: 'מתחילת שנה', twelveMonth: '12 חודשים' }

export function SavingsFundCard({ account, inflation, onEdit, onDelete, onUpdateAmount, onUpdateYield, onRefreshYields }: Props) {
  const [editingAmount, setEditingAmount] = useState(false)
  const [amountDraft, setAmountDraft] = useState('')
  const [editingYield, setEditingYield] = useState<string | null>(null)
  const [yieldDraft, setYieldDraft] = useState('')
  const [hovered, setHovered] = useState(false)
  const [hoveredAmount, setHoveredAmount] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [yieldPeriod, setYieldPeriod] = useState<YieldPeriod>('twelveMonth')

  async function handleRefresh() {
    const code = parseInt(account.fundCode, 10)
    if (isNaN(code) || !onRefreshYields) return
    setRefreshing(true)
    try {
      const ds = account.fundDataset ?? fundTypeToDataset(account.fundType) ?? 'gemel'
      const data = await fetchFullFundData(code, ds)
      if (data) {
        const now = new Date().toISOString().slice(0, 10)
        onRefreshYields({
          yields: {
            monthly: data.yields.monthly,
            ytd: data.yields.ytd,
            twelveMonth: data.yields.twelveMonth,
            threeYear: data.yields.threeYear,
            lastYieldUpdate: now,
          },
          yieldHistory: data.history,
        })
      }
    } catch { /* silent */ }
    finally { setRefreshing(false) }
  }

  const { yields, currentAmount, managementFee } = account
  const nominal = yields[yieldPeriod]

  // Prorate inflation to match selected period
  const inflationForPeriod = (() => {
    if (yieldPeriod === 'monthly') return inflation.annual / 12
    if (yieldPeriod === 'ytd') {
      const elapsedMonths = new Date().getMonth() // 0-based = months elapsed
      return elapsedMonths > 0 ? inflation.annual * elapsedMonths / 12 : inflation.annual / 12
    }
    return inflation.annual
  })()
  const feeForPeriod = (() => {
    if (managementFee == null) return null
    if (yieldPeriod === 'monthly') return managementFee / 12
    if (yieldPeriod === 'ytd') {
      const elapsedMonths = new Date().getMonth()
      return elapsedMonths > 0 ? managementFee * elapsedMonths / 12 : managementFee / 12
    }
    return managementFee
  })()

  const realYield = nominal != null ? nominal - inflationForPeriod : null
  const netReal = realYield != null && feeForPeriod != null ? realYield - feeForPeriod : realYield
  const realEarnings = netReal != null ? currentAmount * netReal / 100 : null

  function startAmountEdit() {
    setAmountDraft(String(currentAmount))
    setEditingAmount(true)
  }

  function commitAmount() {
    onUpdateAmount(parseFloat(amountDraft) || 0)
    setEditingAmount(false)
  }

  function startYieldEdit(field: string, val: number | null) {
    setYieldDraft(val != null ? String(val) : '')
    setEditingYield(field)
  }

  function commitYield() {
    if (!editingYield) return
    const val = yieldDraft.trim() === '' ? null : parseFloat(yieldDraft)
    onUpdateYield(editingYield as 'monthly' | 'ytd' | 'twelveMonth' | 'threeYear', val)
    setEditingYield(null)
  }

  const yieldFields: [string, string, number | null][] = [
    ['monthly', 'חודשי', yields.monthly],
    ['ytd', 'מתחילת שנה', yields.ytd],
    ['twelveMonth', '12 חודשים', yields.twelveMonth],
    ['threeYear', '3 שנים', yields.threeYear],
  ]

  const lastUpdatedFormatted = (() => {
    try {
      const d = new Date(account.lastUpdated)
      return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`
    } catch { return account.lastUpdated }
  })()

  return (
    <div
      style={{ ...s.card, borderTop: `4px solid ${account.color}` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header */}
      <div style={s.cardHeader}>
        <div style={s.planName}>{account.planName || account.name || 'ללא שם'}</div>
        <div style={s.providerBadge}>
          <span>{account.provider}</span>
        </div>
      </div>

      {/* Balance */}
      <div style={s.balanceSection}>
        {editingAmount ? (
          <div style={s.inlineEdit}>
            <input
              style={s.inlineInput}
              type="number"
              value={amountDraft}
              onChange={e => setAmountDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitAmount(); if (e.key === 'Escape') setEditingAmount(false) }}
              autoFocus
            />
            <button style={s.inlineBtn} onClick={commitAmount}>✓</button>
            <button style={s.inlineBtn} onClick={() => setEditingAmount(false)}>✕</button>
          </div>
        ) : (
          <div
            style={{ ...s.balanceAmount, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={startAmountEdit}
            onMouseEnter={() => setHoveredAmount(true)}
            onMouseLeave={() => setHoveredAmount(false)}
            title="לחץ לעריכה"
          >
            {fmt(currentAmount)}
            <Pencil size={16} strokeWidth={1.75} style={{ color: 'var(--text-muted)', opacity: hoveredAmount ? 0.7 : 0, transition: 'opacity 0.15s' }} />
          </div>
        )}
        <span style={s.lastUpdated}>עדכון אחרון: {lastUpdatedFormatted}</span>
      </div>

      {/* Yields + Sparkline inline */}
      <div style={s.sectionTitle}>תשואות</div>
      <div style={s.yieldsRow}>
        <div style={s.yieldsGrid}>
          {yieldFields.map(([field, label, val]) => (
            <div key={field} style={s.yieldItem}>
              <div style={s.yieldLabel}>{label}</div>
              {editingYield === field ? (
                <div style={s.inlineEdit}>
                  <input
                    style={{ ...s.inlineInput, width: 60, fontSize: 13, textAlign: 'center' }}
                    type="number"
                    step="0.1"
                    value={yieldDraft}
                    onChange={e => setYieldDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitYield(); if (e.key === 'Escape') setEditingYield(null) }}
                    autoFocus
                  />
                  <button style={{ ...s.inlineBtn, fontSize: 11 }} onClick={commitYield}>✓</button>
                </div>
              ) : (
                <div
                  style={{ ...s.yieldValue, color: pctColor(val), cursor: 'pointer' }}
                  onClick={() => startYieldEdit(field, val)}
                  title="לחץ לעריכה"
                >
                  {fmtPct(val)}
                </div>
              )}
            </div>
          ))}
        </div>
        {account.yieldHistory.length >= 2 && (
          <div style={s.sparklineWrap}>
            <Sparkline data={account.yieldHistory} color={account.color} />
          </div>
        )}
      </div>

      {/* Real Yield */}
      {nominal != null && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 4, paddingTop: 8 }}>
            <div style={{ ...s.sectionTitle, borderBottom: 'none', paddingBottom: 0 }}>תשואה ריאלית</div>
            <div style={s.pillGroup}>
              {(['monthly', 'ytd', 'twelveMonth'] as YieldPeriod[]).map((p, i, arr) => {
                const radius = i === 0 ? { borderRadius: '0 8px 8px 0' } : i === arr.length - 1 ? { borderRadius: '8px 0 0 8px' } : { borderRadius: 0 }
                return (
                  <button
                    key={p}
                    style={{ ...s.pill, ...(yieldPeriod === p ? s.pillActive : {}), ...radius }}
                    onClick={() => setYieldPeriod(p)}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={s.realYieldTable}>
            <div style={s.realRow}>
              <span style={{ fontSize: 15 }}>תשואה נומינלית ({PERIOD_LABELS[yieldPeriod]})</span>
              <span style={{ fontWeight: 600, fontSize: 16 }}>{fmtPct(nominal)}</span>
            </div>
            <div style={s.realRow}>
              <span style={{ fontSize: 15 }}>אינפלציה ({PERIOD_LABELS[yieldPeriod]})</span>
              <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--red)' }}>-{inflationForPeriod.toFixed(1)}%</span>
            </div>
            <div style={{ ...s.realRow, borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 17 }}>תשואה ריאלית</span>
              <span style={{ fontWeight: 700, fontSize: 20, color: pctColor(realYield) }}>
                {fmtPct(realYield)}
              </span>
            </div>
            {feeForPeriod != null && (
              <>
                <div style={{ ...s.realRow, marginTop: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 15 }}>דמי ניהול</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>{feeForPeriod.toFixed(2)}%</span>
                </div>
                <div style={s.realRow}>
                  <span style={{ fontWeight: 600, fontSize: 16 }}>תשואה נטו (אחרי דמי ניהול)</span>
                  <span style={{ fontWeight: 700, fontSize: 18, color: pctColor(netReal) }}>{fmtPct(netReal)}</span>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Money Impact */}
      {realEarnings != null && (
        <div style={s.impactRow}>
          <span style={{ fontSize: 16, color: 'var(--text-primary)' }}>
            הכסף שלך {realEarnings >= 0 ? 'הרוויח' : 'הפסיד'} ריאלית:
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: realEarnings >= 0 ? 'var(--green)' : 'var(--red)' }}>
              ~{fmt(Math.abs(Math.round(realEarnings)))}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              ({fmt(currentAmount)} × {fmtPct(netReal)})
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ ...s.cardFooter, opacity: hovered ? 1 : 0.4 }}>
        <button className="btn-ghost" style={s.footerBtn} onClick={onEdit}><Pencil size={13} strokeWidth={1.75} /> ערוך</button>
        <button className="btn-ghost" style={{ ...s.footerBtn, color: 'var(--red)' }} onClick={onDelete}><Trash2 size={13} strokeWidth={1.75} /> מחק</button>
        {account.fundCode && (
          <button
            className="btn-ghost"
            style={{ ...s.footerBtn, marginRight: 'auto' }}
            onClick={handleRefresh}
            disabled={refreshing}
            title="עדכן תשואות מגמל נט"
          >
            {refreshing
              ? <Loader2 size={13} strokeWidth={1.75} style={{ animation: 'spin 1s linear infinite' }} />
              : <RefreshCw size={13} strokeWidth={1.75} />
            }
            עדכן תשואות
          </button>
        )}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  card: {
    padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 12,
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  planName: { fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 },
  providerBadge: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 },
  balanceSection: { display: 'flex', flexDirection: 'column', gap: 4 },
  balanceAmount: { fontSize: 34, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' },
  lastUpdated: { fontSize: 12, color: 'var(--text-muted)' },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 4 },
  yieldsRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  yieldsGrid: { display: 'flex', flex: 1, justifyContent: 'space-around' },
  yieldItem: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 },
  yieldLabel: { fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' },
  yieldValue: { fontSize: 20, fontWeight: 700 },
  sparklineWrap: { flexShrink: 0 },
  realYieldTable: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15, color: 'var(--text-secondary)' },
  realRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  impactRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderTop: '1px solid var(--border)', paddingTop: 10 },
  cardFooter: { display: 'flex', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 10, transition: 'opacity 0.2s' },
  footerBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 },
  inlineEdit: { display: 'flex', alignItems: 'center', gap: 4 },
  inlineInput: { padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', background: 'var(--bg-primary)', color: 'var(--text-primary)', width: 120 },
  inlineBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px', color: 'var(--text-muted)' },
  pillGroup: { display: 'flex', gap: -1, marginRight: 'auto' },
  pill: { padding: '4px 12px', border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--text-muted)', background: 'var(--bg-primary)', fontWeight: 500, whiteSpace: 'nowrap', marginLeft: -1, transition: 'background 0.15s, color 0.15s, border-color 0.15s' },
  pillActive: { background: 'var(--bg-surface)', color: 'var(--accent)', fontWeight: 600, borderColor: 'var(--accent)', zIndex: 1 },
}
