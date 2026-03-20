export interface SavingsAccount {
  id: string
  name: string       // שם החיסכון
  managedBy: string  // גוף מנהל
  amount: number     // יתרה נוכחית ב-₪
  updatedAt: number  // timestamp ms
}

export interface ManualEntry {
  id: string
  type: 'expense' | 'income'
  name: string
  amount: number
  recurring: boolean
  category?: string
  notes?: string
  createdAt: number
}

export interface BankEntry {
  id: string
  date: Date
  status: 'actual' | 'expected'
  category: string           // סוג תשלום/תקבול
  vendor: string             // שם ספק/לקוח
  payment: number            // תשלומים (expense amount, 0 if income)
  receipt: number            // תקבולות (income amount, 0 if expense)
  recurring: boolean         // auto-project into future months
  source: 'import' | 'manual'
}

export interface BankSettings {
  startingBalance: number
  projectionMonths: number
}

export interface CreditCardPayment {
  id: string
  date: Date      // charge date
  amount: number  // NIS amount
}

export interface Transaction {
  date: Date
  merchant: string
  amount: number           // סכום חיוב — actual charged amount in ₪
  originalAmount?: number  // סכום עסקה — if foreign currency
  currency?: string        // מטבע עסקה
  notes?: string           // פירוט נוסף (e.g. "הוראת קבע", "תשלום X מתוך Y")
  category?: string        // assigned by user, not from Isracard
}

// ---------------------------------------------------------------------------
// AI Chat response types
// ---------------------------------------------------------------------------
export type AiTextBlock = { type: 'text'; content: string }
export type AiTableBlock = { type: 'table'; headers: string[]; rows: string[][] }
export type AiFilterAction = {
  type: 'action'; action: 'filter'; label: string
  payload: { months?: string[]; categories?: string[]; amountMin?: number; amountMax?: number }
}
export type AiNavigateAction = {
  type: 'action'; action: 'navigate'; label: string
  payload: { tab: 'insights' | 'cashflow' | 'mapping' | 'transactions' }
}
export type AiBlock = AiTextBlock | AiTableBlock | AiFilterAction | AiNavigateAction
export type AiResponse = { blocks: AiBlock[] }

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string          // raw text for user/error messages
  blocks?: AiBlock[]       // parsed blocks for assistant messages
  loading?: boolean        // true while streaming
}
