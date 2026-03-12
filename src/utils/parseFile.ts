import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { Transaction } from '../types'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** DD.MM.YY or DD.MM.YYYY or DD/MM/YY etc. → Date */
function parseIsracardDate(raw: unknown): Date | null {
  const s = String(raw ?? '').trim()
  const match = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/)
  if (!match) return null
  const [, d, m, y] = match
  const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y)
  const date = new Date(year, parseInt(m) - 1, parseInt(d))
  return isNaN(date.getTime()) ? null : date
}

/** Remove ₪, commas, whitespace → positive number */
function parseAmount(raw: unknown): number {
  if (typeof raw === 'number') return Math.abs(raw)
  const cleaned = String(raw ?? '').replace(/[₪,\s]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : Math.abs(n)
}

function normalize(s: unknown): string {
  return String(s ?? '')
    .trim()
    .replace(/\u200f/g, '') // strip RTL mark
    .replace(/"/g, '')
}

// ---------------------------------------------------------------------------
// Isracard XLSX parser
// Sheet: "פירוט עסקאות"
// Header rows: col A === "תאריך רכישה"
// Columns (0-indexed): A=0 date, B=1 merchant, C=2 origAmount, D=3 origCurrency,
//                       E=4 chargeAmount, F=5 chargeCurrency, G=6 voucher, H=7 notes
// ---------------------------------------------------------------------------

const HEADER_MARKER = 'תאריך רכישה'
const SKIP_MARKERS = ['סה"כ', 'סהכ', 'סה״כ'] // summary rows

function isSummaryRow(colB: unknown): boolean {
  const s = normalize(colB)
  return SKIP_MARKERS.some((m) => s.includes(m))
}

function parseIsracardXlsx(buffer: ArrayBuffer): Transaction[] {
  const wb = XLSX.read(buffer, { type: 'array' })

  // Find the sheet
  const sheetName = wb.SheetNames.find((n) => n.includes('פירוט עסקאות')) ?? wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]

  // Get all rows as arrays (raw values, no header inference)
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  console.log(`[Parser] Sheet: "${sheetName}", total rows: ${rows.length}`)

  const transactions: Transaction[] = []
  let inSection = false

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const colA = normalize(row[0])

    // Detect header row → start reading transactions from next row
    if (colA === HEADER_MARKER) {
      inSection = true
      console.log(`[Parser] Found header row at row ${i + 1}`)
      continue
    }

    if (!inSection) continue

    // Stop this section on: empty colA, summary row, or another section header
    if (!colA) {
      inSection = false
      continue
    }
    if (isSummaryRow(row[1])) {
      inSection = false
      continue
    }

    // Try to parse date from col A
    const date = parseIsracardDate(colA)
    if (!date) {
      // Not a transaction row (section header text etc.) — end section
      inSection = false
      continue
    }

    const merchant = normalize(row[1])
    const originalAmount = parseAmount(row[2])
    const currency = normalize(row[3])
    const chargeAmount = parseAmount(row[4])  // col E — always use this
    const notes = normalize(row[7])

    if (!merchant || chargeAmount === 0) continue

    const tx: Transaction = { date, merchant, amount: chargeAmount }
    if (originalAmount && originalAmount !== chargeAmount) tx.originalAmount = originalAmount
    if (currency && currency !== '₪') tx.currency = currency
    if (notes) tx.notes = notes

    transactions.push(tx)
  }

  console.log(`[Parser] Extracted ${transactions.length} transactions`)
  return transactions
}

// ---------------------------------------------------------------------------
// CSV parser (PapaParse) — generic fallback
// ---------------------------------------------------------------------------

const CSV_COLUMN_MAP: Record<string, keyof Pick<Transaction, 'date' | 'merchant' | 'amount' | 'notes' | 'currency'>> = {
  'תאריך רכישה': 'date',
  'תאריך עסקה': 'date',
  'תאריך': 'date',
  'שם בית עסק': 'merchant',
  'שם בית העסק': 'merchant',
  'בית עסק': 'merchant',
  'סכום חיוב': 'amount',
  'סכום לחיוב': 'amount',
  'סכום': 'amount',
  'מטבע עסקה': 'currency',
  'מטבע': 'currency',
  'פירוט נוסף': 'notes',
  'הערות': 'notes',
}

function parseCSV(text: string): Transaction[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalize(h),
  })

  const transactions: Transaction[] = []

  for (const row of result.data) {
    const t: Partial<Transaction> = {}

    for (const [col, value] of Object.entries(row)) {
      const canonical = CSV_COLUMN_MAP[normalize(col)]
      if (!canonical) continue
      const raw = normalize(value)

      if (canonical === 'date') {
        const d = parseIsracardDate(raw)
        if (!d) continue
        t.date = d
      } else if (canonical === 'amount') {
        t.amount = parseAmount(raw)
      } else if (canonical === 'merchant') {
        t.merchant = raw
      } else if (canonical === 'currency') {
        t.currency = raw
      } else if (canonical === 'notes') {
        t.notes = raw
      }
    }

    if (t.date && t.merchant && t.amount && t.amount > 0) {
      transactions.push(t as Transaction)
    }
  }

  return transactions
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function parseFile(file: File): Promise<Transaction[]> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer()
    return parseIsracardXlsx(buffer)
  }

  if (name.endsWith('.csv')) {
    const text = await file.text()
    return parseCSV(text)
  }

  if (name.endsWith('.pdf')) {
    console.warn('[Parser] PDF parsing not yet supported. Export as CSV or Excel.')
    return []
  }

  return []
}

export async function parseFiles(files: File[]): Promise<Transaction[]> {
  const results = await Promise.all(files.map(parseFile))
  const all = results.flat()

  // Deduplicate by date + merchant + amount
  const seen = new Set<string>()
  return all.filter((tx) => {
    const key = `${tx.date.toISOString()}|${tx.merchant}|${tx.amount}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
