import { useState, useRef, useEffect } from 'react'
import type React from 'react'
import { Sparkles, X, Send } from 'lucide-react'
import { useAiChat } from '../hooks/useAiChat'
import { useFilters } from '../context/FilterContext'
import { useCategories } from '../context/CategoriesContext'
import type { Transaction, AiBlock, SavingsAccount, InflationData } from '../types'

interface ChatWidgetProps {
  hasData: boolean
  allTransactions: Transaction[]
  filteredTransactions: Transaction[]
  map: Record<string, string>
  budgets: Record<string, number>
  recurringMerchants: Set<string>
  currentTab?: string
  savingsAccounts?: SavingsAccount[]
  savingsGoal?: number
  inflation?: InflationData
  onNavigate: (tab: string) => void
  onApplyFilter: (filter: { months?: string[]; categories?: string[]; amountMin?: number; amountMax?: number }) => void
}

export function ChatWidget({
  hasData, allTransactions, filteredTransactions, map, budgets, recurringMerchants,
  currentTab, savingsAccounts, savingsGoal, inflation,
  onNavigate, onApplyFilter,
}: ChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [hasKey, setHasKey] = useState(!!localStorage.getItem('anthropic-api-key'))
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { filters } = useFilters()
  const { categories } = useCategories()

  const { messages, isLoading, sendMessage, clearMessages } = useAiChat({
    allTransactions, filteredTransactions, map, categories, budgets, recurringMerchants, filters,
    currentTab, savingsAccounts, savingsGoal, inflation,
  })

  // Re-check API key on open
  useEffect(() => {
    if (open) {
      setHasKey(!!localStorage.getItem('anthropic-api-key'))
      inputRef.current?.focus()
    }
  }, [open])

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const handleClose = () => {
    setOpen(false)
    clearMessages()
  }

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    sendMessage(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAction = (block: AiBlock) => {
    if (block.type !== 'action') return
    if (block.action === 'navigate') onNavigate(block.payload.tab)
    if (block.action === 'filter') onApplyFilter(block.payload)
  }

  if (!hasKey) return null

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={s.fab} title="שאל את Claude">
        <Sparkles size={22} />
      </button>
    )
  }

  return (
    <div style={s.panel}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.headerTitle}>שאל את Claude</span>
        <button onClick={handleClose} style={s.closeBtn}><X size={18} /></button>
      </div>

      {/* Messages */}
      <div ref={listRef} style={s.messageList}>
        {!hasData && (
          <div style={s.emptyState}>יש להעלות קבצים כדי להתחיל לשאול שאלות</div>
        )}
        {messages.map(msg => (
          <div key={msg.id} style={msg.role === 'user' ? s.userMsg : msg.role === 'error' ? s.errorMsg : s.assistantMsg}>
            {msg.role === 'user' && <p style={s.msgText}>{msg.content}</p>}
            {msg.role === 'error' && <p style={s.errorText}>{msg.content}</p>}
            {msg.role === 'assistant' && (
              msg.loading && !msg.blocks
                ? <TypingIndicator />
                : <BlockRenderer blocks={msg.blocks ?? [{ type: 'text', content: msg.content }]} onAction={handleAction} />
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={s.inputBar}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={hasData ? 'שאל שאלה על ההוצאות...' : ''}
          disabled={!hasData || isLoading}
          style={s.input}
          dir="rtl"
        />
        <button onClick={handleSend} disabled={!input.trim() || isLoading || !hasData} style={s.sendBtn}>
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

// --- Sub-components ---

function TypingIndicator() {
  return <div style={s.typing}><span style={s.dot} /><span style={{ ...s.dot, animationDelay: '0.2s' }} /><span style={{ ...s.dot, animationDelay: '0.4s' }} /></div>
}

function renderBoldText(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)
}

function BlockRenderer({ blocks, onAction }: { blocks: AiBlock[]; onAction: (b: AiBlock) => void }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'text') return <p key={i} style={s.msgText}>{renderBoldText(block.content)}</p>
        if (block.type === 'table') return (
          <div key={i} style={s.tableWrap}>
            <table style={s.table}>
              <thead><tr>{block.headers.map((h, j) => <th key={j} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>{block.rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} style={s.td}>{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )
        if (block.type === 'action') return (
          <button key={i} style={s.actionBtn} onClick={() => onAction(block)}>{block.label}</button>
        )
        return null
      })}
    </>
  )
}

// --- Styles ---
const s: Record<string, React.CSSProperties> = {
  fab: { position: 'fixed', bottom: 24, left: 24, width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', transition: 'transform 0.15s ease' },
  panel: { position: 'fixed', bottom: 24, left: 24, width: 500, height: 750, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', direction: 'rtl' },
  headerTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center' },
  messageList: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, direction: 'rtl' },
  emptyState: { textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '40px 20px' },
  userMsg: { alignSelf: 'flex-start', background: 'var(--accent)', color: '#fff', padding: '8px 14px', borderRadius: '14px 14px 4px 14px', maxWidth: '80%', fontSize: 13 },
  assistantMsg: { alignSelf: 'flex-end', background: 'var(--bg-primary)', padding: '10px 14px', borderRadius: '14px 14px 14px 4px', maxWidth: '90%', fontSize: 13, color: 'var(--text-primary)' },
  errorMsg: { alignSelf: 'center', background: 'var(--red-fill, #fef2f2)', padding: '8px 14px', borderRadius: 10, maxWidth: '90%', fontSize: 13 },
  errorText: { margin: 0, color: 'var(--red)', fontSize: 13 },
  msgText: { margin: 0, lineHeight: 1.6, wordBreak: 'break-word' },
  tableWrap: { overflowX: 'auto', margin: '6px 0' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12, direction: 'rtl' },
  th: { textAlign: 'right', padding: '6px 8px', borderBottom: '2px solid var(--border)', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11 },
  td: { textAlign: 'right', padding: '5px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' },
  actionBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', marginTop: 4, transition: 'background 0.15s ease' },
  inputBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', direction: 'rtl' },
  input: { flex: 1, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 10, fontFamily: 'inherit', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' },
  sendBtn: { width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'opacity 0.15s ease' },
  typing: { display: 'flex', gap: 4, padding: '4px 0' },
  dot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', animation: 'chatDotPulse 1s infinite ease-in-out' },
}
