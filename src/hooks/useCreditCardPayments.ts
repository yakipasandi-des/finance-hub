import { useState, useCallback } from 'react'
import type { CreditCardPayment } from '../types'

const STORAGE_KEY = 'creditCardPayments'

function load(): CreditCardPayment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Array<CreditCardPayment & { date: string }>
      if (Array.isArray(parsed)) {
        return parsed.map((e) => ({ ...e, date: new Date(e.date) }))
      }
    }
  } catch { /* ignore */ }
  return []
}

function save(payments: CreditCardPayment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payments))
}

function makeId(): string {
  return `cc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function useCreditCardPayments() {
  const [payments, setPayments] = useState<CreditCardPayment[]>(load)

  const addPayment = useCallback((date?: Date, amount?: number) => {
    const payment: CreditCardPayment = {
      id: makeId(),
      date: date ?? new Date(),
      amount: amount ?? 0,
    }
    setPayments((prev) => {
      const updated = [payment, ...prev]
      save(updated)
      return updated
    })
    return payment.id
  }, [])

  const updatePayment = useCallback((id: string, changes: Partial<Omit<CreditCardPayment, 'id'>>) => {
    setPayments((prev) => {
      const updated = prev.map((p) => p.id === id ? { ...p, ...changes } : p)
      save(updated)
      return updated
    })
  }, [])

  const deletePayment = useCallback((id: string) => {
    setPayments((prev) => {
      const updated = prev.filter((p) => p.id !== id)
      save(updated)
      return updated
    })
  }, [])

  return { payments, addPayment, updatePayment, deletePayment }
}
