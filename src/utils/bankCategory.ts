import type { BankEntry } from '../types'

// Effective insight category for a bank entry: a per-row override (categoryId)
// wins; otherwise fall back to the vendor→category map. Returns undefined when
// neither is set (the row is then excluded from insights/budget).
export function resolveBankCategoryId(
  entry: BankEntry,
  bankCategoryMap: Record<string, string>,
): string | undefined {
  return entry.categoryId ?? bankCategoryMap[entry.vendor]
}
