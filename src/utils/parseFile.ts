import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { Transaction, BankEntry } from '../types'

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
    .replace(/[\u200f\u200e\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069\u061c]/g, '') // strip bidi marks
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
// Bank account XLSX parser
// Detects bank format by scanning for headers like "בפועל/צפוי", "סוג תשלום/תקבול"
// ---------------------------------------------------------------------------

const BANK_HEADER_VARIANTS: Record<string, string[]> = {
  date: ['תאריך'],
  status: ['בפועל/ צפוי', 'בפועל/צפוי', 'בפועל / צפוי', 'סטטוס'],
  category: ['סוג תשלום/תקבול', 'סוג תשלום / תקבול', 'סוג'],
  vendor: ['שם ספק/לקוח', 'שם ספק / לקוח', 'ספק', 'לקוח', 'תיאור פעולה'],
  payment: ['תשלומים', 'חובה'],
  receipt: ['תקבולות', 'זכות'],
  balance: ['יתרה משוערכת', 'יתרה'],
}

function parseBankDate(raw: unknown): Date | null {
  // Handle Excel serial date numbers
  if (typeof raw === 'number' && raw > 30000 && raw < 100000) {
    // Excel serial: days since 1900-01-01 (with the 1900 leap year bug)
    const excelEpoch = new Date(1899, 11, 30) // Dec 30, 1899
    const date = new Date(excelEpoch.getTime() + raw * 86400000)
    return isNaN(date.getTime()) ? null : date
  }
  const s = String(raw ?? '').trim()
  // DD/MM/YYYY or DD.MM.YYYY
  const match = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/)
  if (!match) return null
  const [, d, m, y] = match
  const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y)
  const date = new Date(year, parseInt(m) - 1, parseInt(d))
  return isNaN(date.getTime()) ? null : date
}

function detectBankHeaders(rows: unknown[][]): { headerRow: number; colMap: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i]
    if (!row || row.length < 4) continue

    const cells = row.map((c) => normalize(c))

    // Check if this row contains bank-specific headers
    const hasStatus = cells.some((c) => BANK_HEADER_VARIANTS.status.some((v) => c.includes(normalize(v))))
    const hasPayment = cells.some((c) => BANK_HEADER_VARIANTS.payment.some((v) => c.includes(normalize(v))))

    if (hasStatus || hasPayment) {
      const colMap: Record<string, number> = {}
      for (const [field, variants] of Object.entries(BANK_HEADER_VARIANTS)) {
        for (let j = 0; j < cells.length; j++) {
          if (variants.some((v) => cells[j].includes(normalize(v)))) {
            colMap[field] = j
            break
          }
        }
      }
      // Must have at least date and one of payment/receipt
      if (colMap.date !== undefined && (colMap.payment !== undefined || colMap.receipt !== undefined)) {
        console.log(`[BankParser] Found header row at ${i + 1}, columns:`, colMap)
        return { headerRow: i, colMap }
      }
    }
  }
  return null
}

function makeBankId(): string {
  return `bi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export interface BankParseResult {
  entries: BankEntry[]
  startingBalance?: number
}

export function parseBankExcel(buffer: ArrayBuffer): BankParseResult {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  const detected = detectBankHeaders(rows)
  if (!detected) {
    console.warn('[BankParser] Could not detect bank format headers')
    return { entries: [] }
  }

  const { headerRow, colMap } = detected
  const entries: BankEntry[] = []
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  // Track the oldest entry's balance to compute starting balance
  let oldestBalance: number | null = null
  let oldestPayment = 0
  let oldestReceipt = 0

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 3) continue

    const dateRaw = colMap.date !== undefined ? row[colMap.date] : undefined
    const date = parseBankDate(dateRaw)
    if (!date) continue

    // Determine status: use explicit column if available, else compare date to today
    let status: BankEntry['status']
    if (colMap.status !== undefined) {
      const statusRaw = normalize(row[colMap.status])
      status = statusRaw.includes('בפועל') ? 'actual' : 'expected'
    } else {
      status = date <= today ? 'actual' : 'expected'
    }

    const category = colMap.category !== undefined ? normalize(row[colMap.category]) : ''
    const vendor = colMap.vendor !== undefined ? normalize(row[colMap.vendor]) : ''
    const payment = colMap.payment !== undefined ? parseAmount(row[colMap.payment]) : 0
    const receipt = colMap.receipt !== undefined ? parseAmount(row[colMap.receipt]) : 0

    if (payment === 0 && receipt === 0) continue
    if (!vendor && !category) continue

    // Track balance from the balance column (last valid row = oldest entry)
    if (colMap.balance !== undefined) {
      const rawBal = row[colMap.balance]
      const bal = typeof rawBal === 'number' ? rawBal : parseFloat(String(rawBal).replace(/[₪,\s]/g, ''))
      if (!isNaN(bal)) {
        oldestBalance = bal
        oldestPayment = payment
        oldestReceipt = receipt
      }
    }

    entries.push({
      id: makeBankId(),
      date,
      status,
      category,
      vendor: vendor || category,
      payment,
      receipt,
      recurring: false,
      source: 'import',
    })
  }

  // Compute starting balance: oldest entry's balance is AFTER that entry's transaction
  // So balance before all transactions = oldestBalance + oldestPayment - oldestReceipt
  let startingBalance: number | undefined
  if (oldestBalance !== null) {
    startingBalance = oldestBalance + oldestPayment - oldestReceipt
  }

  console.log(`[BankParser] Extracted ${entries.length} bank entries, startingBalance: ${startingBalance}`)
  return { entries, startingBalance }
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
