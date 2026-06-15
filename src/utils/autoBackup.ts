// Daily auto-backup guardrail.
//
// Once per calendar day (on app load) we snapshot all persisted data into a
// dedicated `autoBackups` localStorage key, keeping the last MAX_BACKUPS days.
// Crucially this key is NOT touched by the Settings import / reset-categories
// flows, so it survives the exact actions that can silently wipe categories.
// A snapshot is the same shape the manual Export/Import uses, so restoring
// reuses identical logic.

const AUTO_BACKUP_KEY = 'autoBackups'
const MAX_BACKUPS = 7

// Keys mirror the manual export payload (handleExport in SettingsTab).
const BACKUP_KEYS = [
  'categories',
  'merchantCategoryMap',
  'bankCategoryMap',
  'savings',
  'budgets',
  'manualEntries',
  'bankEntries',
  'bankSettings',
] as const

export interface BackupSnapshot {
  version: 1
  auto: true
  /** Local calendar day, YYYY-MM-DD — used for the once-per-day check. */
  date: string
  /** Full ISO timestamp the snapshot was taken. */
  exportedAt: string
  categories: string | null
  merchantCategoryMap: string | null
  bankCategoryMap: string | null
  savings: string | null
  budgets: string | null
  manualEntries: string | null
  bankEntries: string | null
  bankSettings: string | null
}

function todayKey(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function buildSnapshot(): BackupSnapshot {
  const snap = {
    version: 1,
    auto: true,
    date: todayKey(),
    exportedAt: new Date().toISOString(),
  } as BackupSnapshot
  for (const key of BACKUP_KEYS) {
    snap[key] = localStorage.getItem(key)
  }
  return snap
}

/** A snapshot is worth keeping only if there's actually something persisted. */
function hasData(snap: BackupSnapshot): boolean {
  return BACKUP_KEYS.some((key) => snap[key] != null)
}

export function listSnapshots(): BackupSnapshot[] {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Newest first for display.
    return [...(parsed as BackupSnapshot[])].sort((a, b) => b.exportedAt.localeCompare(a.exportedAt))
  } catch {
    return []
  }
}

/**
 * Run once on app load. If today's snapshot hasn't been taken yet and there's
 * data to protect, append one and trim to the last MAX_BACKUPS days.
 */
export function runDailyBackup(): void {
  try {
    const snap = buildSnapshot()
    if (!hasData(snap)) return

    const existing = listSnapshots()
    if (existing.some((s) => s.date === snap.date)) return // already backed up today

    // Keep chronological order (oldest first) in storage, trim to MAX_BACKUPS.
    const next = [...existing, snap]
      .sort((a, b) => a.exportedAt.localeCompare(b.exportedAt))
      .slice(-MAX_BACKUPS)
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(next))
  } catch {
    // Quota or serialization issues shouldn't break app startup.
  }
}

/** Restore a snapshot's data into localStorage. Caller reloads afterward. */
export function restoreSnapshot(snapshot: BackupSnapshot): void {
  for (const key of BACKUP_KEYS) {
    const value = snapshot[key]
    if (value != null) localStorage.setItem(key, value)
  }
}

export function clearAutoBackups(): void {
  localStorage.removeItem(AUTO_BACKUP_KEY)
}
