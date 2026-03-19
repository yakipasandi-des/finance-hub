import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceDot, Label,
} from 'recharts'

export interface BalancePoint {
  label: string
  date: string  // ISO date for sorting/matching
  // Split series: one for actual, one for projected
  actual: number | null
  proj: number | null
}

interface BalanceChartProps {
  data: BalancePoint[]
  minBalanceLabel?: string
  minBalanceValue?: number
  minBalanceSeries?: 'actual' | 'proj'
}

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

export function BalanceChart({ data, minBalanceLabel, minBalanceValue }: BalanceChartProps) {
  if (data.length === 0) return <p style={s.empty}>אין נתונים להצגה.</p>

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ left: 16, right: 8, top: 16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: 'var(--text-secondary)', fontFamily: 'inherit' }}
        />
        <YAxis
          width={60}
          tickFormatter={(v: number) => '₪' + (Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'K' : v)}
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
        />
        <Tooltip
          formatter={(v: number, name: string) => [fmt(v), name === 'actual' ? 'בפועל' : 'תחזית']}
          contentStyle={{ fontFamily: 'inherit', direction: 'rtl', fontSize: 13 }}
        />
        <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 4" />
        <Area
          dataKey="actual"
          stroke="#0d9488"
          fill="#0d948825"
          strokeWidth={2}
          connectNulls={false}
          dot={{ r: 3, fill: '#0d9488' }}
          name="actual"
        />
        <Area
          dataKey="proj"
          stroke="#4338ca"
          fill="#4338ca15"
          strokeWidth={2}
          strokeDasharray="6 3"
          connectNulls={false}
          dot={{ r: 3, fill: '#4338ca' }}
          name="proj"
        />
        {minBalanceLabel !== undefined && minBalanceValue !== undefined && (
          <ReferenceDot
            x={minBalanceLabel}
            y={minBalanceValue}
            r={6}
            fill="#e11d48"
            stroke="#fff"
            strokeWidth={2}
            ifOverflow="extendDomain"
          >
            <Label
              value={`שפל: ${fmt(minBalanceValue)}`}
              position="bottom"
              offset={10}
              fill="#e11d48"
              fontSize={11}
              fontFamily="inherit"
            />
          </ReferenceDot>
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}

const s: Record<string, React.CSSProperties> = {
  empty: {
    color: 'var(--text-muted)',
    fontSize: 14,
    textAlign: 'center',
    padding: '24px 0',
    margin: 0,
  },
}
