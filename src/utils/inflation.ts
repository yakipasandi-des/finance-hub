/**
 * CBS (הלשכה המרכזית לסטטיסטיקה) — Consumer Price Index API
 * Fetches CPI data to get current annual inflation rate.
 * Public API, no auth required.
 */

const CPI_ID = '120010' // מדד המחירים לצרכן - כללי
const BASE = 'https://api.cbs.gov.il/index/data/price'

interface CpiMonth {
  year: number
  month: number
  percent: number      // month-over-month change %
  percentYear: number  // year-over-year change %
}

interface CpiResponse {
  month: {
    code: number
    name: string
    date: CpiMonth[]
  }[]
}

export interface InflationFetchResult {
  annual: number           // latest year-over-year %
  lastUpdated: string      // ISO date
  monthlyHistory: { month: string; rate: number }[]  // last 12 months of monthly changes
}

export async function fetchInflation(): Promise<InflationFetchResult> {
  const url = `${BASE}?id=${CPI_ID}&format=json&last=13`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CBS API error: ${res.status}`)
  const json = await res.json() as CpiResponse

  const series = json.month?.[0]
  if (!series?.date?.length) throw new Error('No CPI data returned')

  // Sort by date ascending
  const sorted = [...series.date].sort((a, b) => a.year - b.year || a.month - b.month)

  // Latest entry has the current year-over-year inflation
  const latest = sorted[sorted.length - 1]
  const annual = latest.percentYear

  // Build monthly history
  const monthlyHistory = sorted.map(d => ({
    month: `${d.year}-${String(d.month).padStart(2, '0')}`,
    rate: d.percent,
  }))

  const lastUpdated = `${latest.year}-${String(latest.month).padStart(2, '0')}-15`

  return { annual, lastUpdated, monthlyHistory }
}
