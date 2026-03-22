/**
 * GemelNet + Pension-Net API — Israeli government savings/pension fund data
 * Sources:
 *   GemelNet:    https://data.gov.il/he/datasets/cma/gemelnet    (גמל, השתלמות)
 *   Pension-Net: https://data.gov.il/he/datasets/cma/pensianet   (פנסיה)
 * Public CKAN datastore API, no auth required.
 */

export type Dataset = 'gemel' | 'pensia'

const RESOURCE_IDS: Record<Dataset, string> = {
  gemel:  'a30dcbea-a1d2-482c-ae29-8f781f5025fb',
  pensia: '6d47d6b5-cb08-488b-b333-f1e717b1e1bd',
}
const BASE = 'https://data.gov.il/api/3/action/datastore_search'

/** Map app fund type → API dataset. Returns undefined for types without an API. */
export function fundTypeToDataset(fundType: string): Dataset | undefined {
  switch (fundType) {
    case 'gemel':
    case 'hishtalmut':
      return 'gemel'
    case 'pensia':
      return 'pensia'
    default:
      return undefined  // bituach, polisat, other — no API
  }
}

interface GemelRecord {
  FUND_ID: number
  FUND_NAME: string
  FUND_CLASSIFICATION: string
  MANAGING_CORPORATION: string
  CONTROLLING_CORPORATION: string
  REPORT_PERIOD: number
  MONTHLY_YIELD: number | null
  YEAR_TO_DATE_YIELD: number | null
  YIELD_TRAILING_3_YRS: number | null
  AVG_ANNUAL_YIELD_TRAILING_3YRS: number | null
  AVG_ANNUAL_MANAGEMENT_FEE: number | null
  TOTAL_ASSETS: number | null
}

export interface FundSearchResult {
  fundId: number
  fundName: string
  provider: string
  classification: string
  dataset: Dataset
}

export interface FundYieldData {
  monthly: number | null
  ytd: number | null
  twelveMonth: number | null    // we'll compute from history if not directly available
  threeYear: number | null      // annualized
  managementFee: number | null
  reportPeriod: number          // YYYYMM
  fundName: string
  provider: string
  classification: string
}

export interface FundHistoryPoint {
  month: string   // "2026-01"
  yield: number   // monthly yield %
}

async function query(params: Record<string, string>, dataset: Dataset = 'gemel'): Promise<GemelRecord[]> {
  const url = new URL(BASE)
  url.searchParams.set('resource_id', RESOURCE_IDS[dataset])
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error('API returned success=false')
  return json.result.records as GemelRecord[]
}

function periodToMonth(period: number): string {
  const s = String(period)
  return `${s.slice(0, 4)}-${s.slice(4, 6)}`
}

/** Search funds by name or code. Searches given dataset(s). */
export async function searchFunds(q: string, datasets?: Dataset[]): Promise<FundSearchResult[]> {
  const dsList = datasets ?? (['gemel', 'pensia'] as Dataset[])

  async function searchOne(ds: Dataset): Promise<FundSearchResult[]> {
    // Try numeric search first (fund code)
    const asNum = parseInt(q, 10)
    if (!isNaN(asNum) && String(asNum) === q.trim()) {
      const records = await query({
        filters: JSON.stringify({ FUND_ID: asNum }),
        sort: 'REPORT_PERIOD desc',
        limit: '1',
      }, ds)
      if (records.length > 0) {
        return [{
          fundId: records[0].FUND_ID,
          fundName: records[0].FUND_NAME,
          provider: records[0].MANAGING_CORPORATION,
          classification: records[0].FUND_CLASSIFICATION,
          dataset: ds,
        }]
      }
    }

    // Text search by fund name
    const records = await query({
      q: q,
      sort: 'REPORT_PERIOD desc',
      limit: '50',
    }, ds)

    // Deduplicate by FUND_ID (API returns multiple months per fund)
    const seen = new Map<number, FundSearchResult>()
    for (const r of records) {
      if (!seen.has(r.FUND_ID)) {
        seen.set(r.FUND_ID, {
          fundId: r.FUND_ID,
          fundName: r.FUND_NAME,
          provider: r.MANAGING_CORPORATION,
          classification: r.FUND_CLASSIFICATION,
          dataset: ds,
        })
      }
    }
    return [...seen.values()]
  }

  const results = await Promise.all(dsList.map(searchOne))
  return results.flat().slice(0, 20)
}

/** Fetch the latest yield data for a fund by its code. */
export async function fetchFundData(fundId: number, dataset: Dataset = 'gemel'): Promise<FundYieldData | null> {
  const records = await query({
    filters: JSON.stringify({ FUND_ID: fundId }),
    sort: 'REPORT_PERIOD desc',
    limit: '1',
  }, dataset)
  if (records.length === 0) return null
  const r = records[0]
  return {
    monthly: r.MONTHLY_YIELD,
    ytd: r.YEAR_TO_DATE_YIELD,
    twelveMonth: null, // will compute from history
    threeYear: r.AVG_ANNUAL_YIELD_TRAILING_3YRS,
    managementFee: r.AVG_ANNUAL_MANAGEMENT_FEE,
    reportPeriod: r.REPORT_PERIOD,
    fundName: r.FUND_NAME,
    provider: r.MANAGING_CORPORATION,
    classification: r.FUND_CLASSIFICATION,
  }
}

/** Fetch N months of history for sparkline + compute 12-month yield. */
export async function fetchFundHistory(fundId: number, months = 12, dataset: Dataset = 'gemel'): Promise<{
  history: FundHistoryPoint[]
  twelveMonthYield: number | null
}> {
  const records = await query({
    filters: JSON.stringify({ FUND_ID: fundId }),
    sort: 'REPORT_PERIOD desc',
    limit: String(months),
  }, dataset)

  // Reverse to chronological order
  const sorted = [...records].reverse()

  const history: FundHistoryPoint[] = sorted
    .filter(r => r.MONTHLY_YIELD != null)
    .map(r => ({
      month: periodToMonth(r.REPORT_PERIOD),
      yield: r.MONTHLY_YIELD!,
    }))

  // Compute 12-month cumulative yield from monthly returns
  // (1+r1)(1+r2)...(1+r12) - 1
  let twelveMonthYield: number | null = null
  if (history.length >= 2) {
    let cumulative = 1
    for (const h of history) {
      cumulative *= (1 + h.yield / 100)
    }
    twelveMonthYield = Math.round((cumulative - 1) * 10000) / 100 // round to 2 decimals
  }

  return { history, twelveMonthYield }
}

/** Fetch complete data for a fund: latest yields + history. */
export async function fetchFullFundData(fundId: number, dataset: Dataset = 'gemel'): Promise<{
  yields: FundYieldData
  history: FundHistoryPoint[]
} | null> {
  const [latest, histData] = await Promise.all([
    fetchFundData(fundId, dataset),
    fetchFundHistory(fundId, 12, dataset),
  ])
  if (!latest) return null
  latest.twelveMonth = histData.twelveMonthYield
  return { yields: latest, history: histData.history }
}
