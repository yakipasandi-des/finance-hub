import { useState } from 'react'
import { FileUpload } from './components/FileUpload'
import { Dashboard } from './components/Dashboard'
import { parseFiles } from './utils/parseFile'
import { useCategoryMap } from './hooks/useCategoryMap'
import { CategoriesProvider } from './context/CategoriesContext'
import type { Transaction } from './types'

type Status = 'idle' | 'parsing' | 'done' | 'error'

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const { map, setMapping, applyAutoSuggest } = useCategoryMap()

  const handleFilesSelect = async (files: File[]) => {
    if (files.length === 0) return
    setStatus('parsing')
    setErrorMsg(null)

    try {
      const result = await parseFiles(files)

      console.group('Finance Hub — parsed data')
      console.log(`Total transactions: ${result.length}`)
      console.log(`Files: ${files.map((f) => f.name).join(', ')}`)
      if (result.length > 0) {
        console.log('First 5 transactions:', result.slice(0, 5))
        const byMerchant = result.reduce<Record<string, number>>((acc, t) => {
          acc[t.merchant] = (acc[t.merchant] ?? 0) + t.amount
          return acc
        }, {})
        console.log(
          'Top 10 merchants:',
          Object.fromEntries(Object.entries(byMerchant).sort(([, a], [, b]) => b - a).slice(0, 10)),
        )
        console.log('Total: ₪' + result.reduce((s, t) => s + t.amount, 0).toLocaleString('he-IL'))
      }
      console.groupEnd()

      if (result.length === 0) {
        setErrorMsg('לא נמצאו עסקאות בקובץ. בדוק שהקובץ מכיל נתוני ישראכרט תקינים.')
        setStatus('error')
        return
      }

      applyAutoSuggest(result)
      setTransactions(result)
      setStatus('done')
    } catch (err) {
      console.error('Parse error:', err)
      setErrorMsg('שגיאה בקריאת הקובץ. נסה לייצא מחדש.')
      setStatus('error')
    }
  }

  const handleReset = () => {
    setTransactions([])
    setStatus('idle')
    setErrorMsg(null)
  }

  const handleClearAll = () => {
    localStorage.removeItem('merchantCategoryMap')
    localStorage.removeItem('categories')
    window.location.reload()
  }

  if (status === 'done' && transactions.length > 0) {
    return (
      <CategoriesProvider>
        <Dashboard
          transactions={transactions}
          map={map}
          setMapping={setMapping}
          onReset={handleReset}
          onClearAll={handleClearAll}
        />
      </CategoriesProvider>
    )
  }

  return (
    <div>
      <FileUpload onFilesSelect={handleFilesSelect} />

      {status === 'parsing' && (
        <div style={styles.overlay}>
          <p style={styles.parsingText}>מנתח קובץ...</p>
        </div>
      )}

      {status === 'error' && errorMsg && (
        <p style={styles.error}>{errorMsg}</p>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(244,242,238,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  parsingText: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    fontFamily: 'inherit',
    margin: 0,
  },
  error: {
    textAlign: 'center',
    color: 'var(--red)',
    fontSize: '14px',
    fontWeight: 500,
    marginTop: '-8px',
    fontFamily: 'inherit',
  },
}

export default App
