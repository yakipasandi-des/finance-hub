import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react'

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.pdf']

function isValidFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext)) && file.size > 0
}

function fileIcon(file: File): string {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return '📕'
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return '📊'
  return '📄'
}

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void
}

export function FileUpload({ onFilesSelect }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming)
      const valid = list.filter(isValidFile)
      const invalid = list.filter((f) => !isValidFile(f))

      if (invalid.length > 0 && valid.length === 0) {
        setError('הקבצים אינם תקינים. יש להעלות קבצי CSV, Excel או PDF.')
        return
      }
      if (invalid.length > 0) {
        setError(`${invalid.length} קבצים דולגו — סוג לא נתמך.`)
      } else {
        setError(null)
      }

      setUploadedFiles((prev) => {
        const merged = [...prev]
        for (const f of valid) {
          if (!merged.some((existing) => existing.name === f.name)) {
            merged.push(f)
          }
        }
        onFilesSelect(merged)
        return merged
      })
    },
    [onFilesSelect],
  )

  const removeFile = (name: string) => {
    setUploadedFiles((prev) => {
      const next = prev.filter((f) => f.name !== name)
      onFilesSelect(next)
      return next
    })
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
  }

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFiles(e.target.files)
      e.target.value = ''
    }
  }

  const hasFiles = uploadedFiles.length > 0

  return (
    <div style={styles.page}>
      <div
        style={{
          ...styles.dropZone,
          ...(isDragging ? styles.dropZoneActive : {}),
          ...(hasFiles ? styles.dropZoneCompact : {}),
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="גרור קבצים לכאן או לחץ לבחירת קבצים"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.pdf"
          multiple
          style={{ display: 'none' }}
          onChange={onInputChange}
        />

        <div style={styles.icon}>{hasFiles ? '📂' : '📄'}</div>

        <p style={styles.mainText}>
          {hasFiles ? 'גרור קבצים נוספים לכאן' : 'גרור קבצים לכאן'}
        </p>
        <p style={styles.subText}>CSV, Excel או PDF · ניתן לבחור מספר קבצים</p>

        <button
          style={styles.button}
          onClick={(e) => {
            e.stopPropagation()
            inputRef.current?.click()
          }}
        >
          {hasFiles ? 'הוסף קבצים' : 'בחר קבצים'}
        </button>

        {error && <p style={styles.error}>{error}</p>}
      </div>

      {hasFiles && (
        <div style={styles.fileList}>
          <p style={styles.fileListTitle}>קבצים שנבחרו ({uploadedFiles.length})</p>
          {uploadedFiles.map((f) => (
            <div key={f.name} style={styles.fileRow}>
              <span style={styles.fileRowIcon}>{fileIcon(f)}</span>
              <span style={styles.fileRowName} dir="ltr">
                {f.name}
              </span>
              <span style={styles.fileRowSize}>
                {(f.size / 1024).toFixed(0)} KB
              </span>
              <button
                style={styles.removeBtn}
                onClick={() => removeFile(f.name)}
                aria-label={`הסר ${f.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <p style={styles.hint}>
        ייצא קובץ מאתר ישראכרט ← גרור לכאן ← קבל תובנות
      </p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    gap: '16px',
  },
  dropZone: {
    width: '100%',
    maxWidth: '480px',
    minHeight: '280px',
    background: 'var(--bg-surface)',
    border: '2px dashed #c0b8d8',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '40px 32px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    outline: 'none',
    userSelect: 'none',
  },
  dropZoneCompact: {
    minHeight: '180px',
  },
  dropZoneActive: {
    borderStyle: 'solid',
    borderColor: 'var(--accent)',
    background: '#ede9f8',
  },
  icon: {
    fontSize: '48px',
    lineHeight: 1,
    marginBottom: '4px',
  },
  mainText: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  subText: {
    margin: 0,
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  button: {
    marginTop: '12px',
    padding: '10px 28px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  error: {
    margin: '10px 0 0',
    fontSize: '14px',
    color: 'var(--red)',
    fontWeight: 500,
    textAlign: 'center',
  },
  fileList: {
    width: '100%',
    maxWidth: '480px',
    background: 'var(--bg-surface)',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fileListTitle: {
    margin: '0 0 4px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    background: 'var(--bg-primary)',
    borderRadius: '8px',
  },
  fileRowIcon: {
    fontSize: '18px',
    flexShrink: 0,
  },
  fileRowName: {
    flex: 1,
    fontSize: '13px',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fileRowSize: {
    fontSize: '12px',
    color: 'var(--text-faint)',
    flexShrink: 0,
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-faint)',
    fontSize: '14px',
    padding: '0 4px',
    lineHeight: 1,
    flexShrink: 0,
  },
  hint: {
    margin: 0,
    fontSize: '13px',
    color: 'var(--text-faint)',
    textAlign: 'center',
  },
}
