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
  const [smoothed, setSmoothed] = useState(false)
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

  // On first render, hide categories beyond top 5
  const defaultHidden = useMemo(() => {
    const set = new Set<string>()
    rankedCats.forEach((cat, i) => { if (i >= 5) set.add(cat.id) })
    return set
  }, [rankedCats])

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

  // Compute display data (raw or rolling average)
  const displayData = useMemo(() => {
    if (!smoothed) return monthlyData
    return monthlyData.map((row, i) => {
      const entry: Record<string, number | string> = { month: row.month }
      for (const cat of categories) {
        const vals: number[] = []
        for (let j = Math.max(0, i - 2); j <= i; j++) {
          const v = monthlyData[j][cat.id]
          if (typeof v === 'number') vals.push(v)
        }
        if (vals.length > 0) {
          entry[cat.id] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
        }
      }
      return entry
    })
  }, [monthlyData, categories, smoothed])

  // Top movers: compare last two months
  const topMovers = useMemo(() => {
    if (monthlyData.length < 2) return []
    const last = monthlyData[monthlyData.length - 1]
    const prev = monthlyData[monthlyData.length - 2]
    const movers: { cat: typeof categories[0]; change: number; pctChange: number; current: number; previous: number }[] = []
    for (const cat of categories) {
      const current = typeof last[cat.id] === 'number' ? last[cat.id] as number : 0
      const previous = typeof prev[cat.id] === 'number' ? prev[cat.id] as number : 0
      const change = current - previous
      const pctChange = previous > 0 ? (change / previous) * 100 : 0
      if (change !== 0) {
        movers.push({ cat, change, pctChange, current, previous })
      }
    }
    movers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    return movers.slice(0, 3)
  }, [monthlyData, categories])

  if (monthlyData.length === 0) {
    return <p style={styles.empty}>אין נתונים להצגת מגמות.</p>
  }

  return (
    <div>
      {/* Toggle buttons */}
      <div style={styles.toggleRow}>
        <button
          style={{ ...styles.toggleBtn, ...(!smoothed ? styles.toggleActive : {}) }}
          onClick={() => setSmoothed(false)}
        >
          ערכים חודשיים
        </button>
        <button
          style={{ ...styles.toggleBtn, ...(smoothed ? styles.toggleActive : {}) }}
          onClick={() => setSmoothed(true)}
        >
          ממוצע נע
        </button>
      </div>

      {/* Line chart */}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={displayData} margin={{ left: 20, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-secondary)', fontFamily: 'inherit' }} />
          <YAxis width={55} tickFormatter={(v: number) => '₪' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : String(v))} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <Tooltip
            formatter={(v: number, name: string) => {
              const cat = categories.find((c) => c.id === name)
              return [fmt(v), cat ? cat.name : name]
            }}
            contentStyle={{ fontFamily: 'inherit', direction: 'rtl', fontSize: 13 }}
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
                strokeWidth={hoveredCat === cat.id ? (smoothed ? 4 : 3) : (smoothed ? 3 : 2)}
                strokeDasharray={smoothed ? undefined : '5 3'}
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
          return (
            <button
              key={cat.id}
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
          )
        })}
      </div>

      {/* Top movers */}
      {topMovers.length > 0 && (
        <div style={styles.moversSection}>
          <div style={styles.moversTitle}>מובילי שינוי</div>
          {topMovers.map((mover, i) => {
            const isIncrease = mover.change > 0
            // For expenses: increase = bad (red), decrease = good (green)
            const color = isIncrease ? 'var(--red)' : 'var(--green)'
            const arrow = isIncrease ? '↑' : '↓'
            return (
              <div key={i} style={styles.moverRow}>
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
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  empty: { color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '24px 0', margin: 0 },
  toggleRow: { display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-primary)', borderRadius: 10, padding: 4, width: 'fit-content', direction: 'rtl' },
  toggleBtn: { padding: '6px 14px', border: '1px solid transparent', borderRadius: 7, background: 'transparent', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' },
  toggleActive: { background: 'var(--bg-surface)', color: 'var(--text-primary)', fontWeight: 700, border: '1px solid var(--border)' },
  legend: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: 'center', marginTop: 12, direction: 'rtl' },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 },
  moversSection: { marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', direction: 'rtl' },
  moversTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 },
  moverRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13 },
  moverName: { color: 'var(--text-secondary)', fontSize: 13 },
}
