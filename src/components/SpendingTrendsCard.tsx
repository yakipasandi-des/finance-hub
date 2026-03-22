import { useState, useMemo } from 'react'
import type React from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { CategoryIcon } from '../icons'

interface SpendingTrendsProps {
  monthlyData: { month: string; [categoryId: string]: number | string }[]
  categories: { id: string; name: string; icon: string; color: string }[]
}

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

export function SpendingTrendsCard({ monthlyData, categories }: SpendingTrendsProps) {
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set())
  const [hoveredCat, setHoveredCat] = useState<string | null>(null)

  // Rank categories by total spending, default show top 5
  const rankedCats = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const cat of categories) {
      totals[cat.id] = 0
      for (const row of monthlyData) {
        totals[cat.id] += (typeof row[cat.id] === 'number' ? row[cat.id] as number : 0)
      }
    }
    return [...categories].sort((a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0))
  }, [categories, monthlyData])

  // All categories visible by default
  const defaultHidden = useMemo(() => new Set<string>(), [])

  // Use defaultHidden merged with user toggles
  const [userToggled, setUserToggled] = useState<Set<string>>(new Set())
  const effectiveHidden = useMemo(() => {
    const set = new Set(defaultHidden)
    for (const id of userToggled) {
      if (set.has(id)) set.delete(id)
      else set.add(id)
    }
    // Also apply explicit hiddenCats
    for (const id of hiddenCats) {
      if (!userToggled.has(id)) set.add(id)
    }
    return set
  }, [defaultHidden, userToggled, hiddenCats])

  const toggleCategory = (catId: string) => {
    setUserToggled((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
    // Also toggle in hiddenCats for explicit user control
    setHiddenCats((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  // Per-category trend data (last vs previous month)
  const catTrends = useMemo(() => {
    if (monthlyData.length < 2) return {} as Record<string, { change: number; pctChange: number; current: number; previous: number }>
    const last = monthlyData[monthlyData.length - 1]
    const prev = monthlyData[monthlyData.length - 2]
    const map: Record<string, { change: number; pctChange: number; current: number; previous: number }> = {}
    for (const cat of categories) {
      const current = typeof last[cat.id] === 'number' ? last[cat.id] as number : 0
      const previous = typeof prev[cat.id] === 'number' ? prev[cat.id] as number : 0
      const change = current - previous
      const pctChange = previous > 0 ? (change / previous) * 100 : 0
      map[cat.id] = { change, pctChange, current, previous }
    }
    return map
  }, [monthlyData, categories])

  // Top movers: compare last two months
  const topMovers = useMemo(() => {
    const movers: { cat: typeof categories[0]; change: number; pctChange: number; current: number; previous: number }[] = []
    for (const cat of categories) {
      const trend = catTrends[cat.id]
      if (trend && trend.change !== 0) {
        movers.push({ cat, ...trend })
      }
    }
    movers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    return movers.slice(0, 3)
  }, [categories, catTrends])

  if (monthlyData.length === 0) {
    return <p style={styles.empty}>אין נתונים להצגת מגמות.</p>
  }

  return (
    <div>
      {/* Line chart */}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={monthlyData} margin={{ left: 20, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-secondary)', fontFamily: 'inherit' }} />
          <YAxis width={55} tickFormatter={(v: number) => '₪' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : String(v))} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            formatter={(v: number, name: string) => {
              const cat = categories.find((c) => c.id === name)
              return [fmt(v), cat ? cat.name : name]
            }}
            contentStyle={{ fontFamily: 'inherit', direction: 'rtl', fontSize: 13, background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
          {rankedCats.map((cat) => {
            if (effectiveHidden.has(cat.id)) return null
            const dimmed = hoveredCat !== null && hoveredCat !== cat.id
            return (
              <Line
                key={cat.id}
                type="monotone"
                dataKey={cat.id}
                stroke={cat.color}
                strokeWidth={hoveredCat === cat.id ? 3 : 2}
                strokeDasharray="5 3"
                strokeOpacity={dimmed ? 0.15 : 1}
                dot={{ r: dimmed ? 2 : 3, fill: cat.color, fillOpacity: dimmed ? 0.15 : 1, strokeOpacity: dimmed ? 0.15 : 1 }}
                activeDot={dimmed ? false : { r: 5 }}
                connectNulls
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Clickable legend */}
      <div style={styles.legend}>
        {rankedCats.map((cat) => {
          const isHidden = effectiveHidden.has(cat.id)
          const trend = catTrends[cat.id]
          const showTrend = hoveredCat === cat.id && !isHidden && trend
          return (
            <div key={cat.id} style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                style={styles.legendItem}
                onClick={() => toggleCategory(cat.id)}
                onMouseEnter={() => { if (!isHidden) setHoveredCat(cat.id) }}
                onMouseLeave={() => setHoveredCat(null)}
              >
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: isHidden ? 'var(--border)' : cat.color,
                  flexShrink: 0,
                  display: 'inline-block',
                }} />
                <span style={{
                  color: isHidden ? 'var(--text-muted)' : 'var(--text-secondary)',
                  textDecoration: isHidden ? 'line-through' : 'none',
                }}>
                  {cat.name}
                </span>
              </button>
              {showTrend && (
                <div style={styles.trendTooltip}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <CategoryIcon icon={cat.icon} size={14} />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cat.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>חודש קודם: {fmt(trend.previous)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <span style={{ color: 'var(--text-muted)' }}>חודש נוכחי: {fmt(trend.current)}</span>
                  </div>
                  {trend.change !== 0 && (
                    <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: trend.change > 0 ? 'var(--red)' : 'var(--green)' }}>
                      {trend.change > 0 ? '↑' : '↓'} {fmt(Math.abs(trend.change))}
                      {trend.pctChange !== 0 && ` (${Math.abs(Math.round(trend.pctChange))}%)`}
                    </div>
                  )}
                  {trend.change === 0 && (
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>ללא שינוי</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Top movers */}
      {topMovers.length > 0 && (
        <div style={styles.moversSection}>
          <div style={styles.moversTitle}>מובילי שינוי</div>
          <div style={styles.moversRow}>
            {topMovers.map((mover, i) => {
              const isIncrease = mover.change > 0
              const color = isIncrease ? 'var(--red)' : 'var(--green)'
              const arrow = isIncrease ? '↑' : '↓'
              return (
                <div key={i} style={styles.moverItem}>
                  <span style={{ color: mover.cat.color, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <CategoryIcon icon={mover.cat.icon} size={16} />
                  </span>
                  <span style={styles.moverName}>{mover.cat.name}</span>
                  <span style={{ color, fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 2 }}>
                    {arrow} {fmt(Math.abs(mover.change))}
                  </span>
                  {mover.pctChange !== 0 && (
                    <span style={{ color, fontSize: 11, fontWeight: 500 }}>
                      ({Math.abs(Math.round(mover.pctChange))}%)
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  empty: { color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '24px 0', margin: 0 },
  legend: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: 'center', marginTop: 12, direction: 'rtl' },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 },
  moversSection: { marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', direction: 'rtl' },
  moversTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 },
  moversRow: { display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' as const },
  moverItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 },
  moverName: { color: 'var(--text-secondary)', fontSize: 13 },
  trendTooltip: {
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: 'var(--shadow-lg)',
    padding: '10px 14px',
    zIndex: 100,
    whiteSpace: 'nowrap',
    direction: 'rtl',
    fontSize: 12,
    pointerEvents: 'none',
  } as React.CSSProperties,
}
