export interface SavingsAccount {
  id: string
  name: string       // שם החיסכון
  managedBy: string  // גוף מנהל
  amount: number     // יתרה נוכחית ב-₪
  updatedAt: number  // timestamp ms
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
