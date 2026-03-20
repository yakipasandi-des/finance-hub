import { useState, useCallback, useRef } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import type { AiResponse, AiBlock, ChatMessage } from '../types'
import type { Category } from '../categories'
import type { Filters } from '../context/FilterContext'
import type { Transaction } from '../types'
import { buildDataSnapshot } from '../utils/buildDataSnapshot'

interface UseAiChatInput {
  allTransactions: Transaction[]
  filteredTransactions: Transaction[]
  map: Record<string, string>
  categories: Category[]
  budgets: Record<string, number>
  recurringMerchants: Set<string>
  filters: Filters
}

const SYSTEM_PROMPT_SUFFIX = `
אתה עוזר פיננסי חכם. אתה מנתח נתוני הוצאות של המשתמש ועונה בעברית.

החזר תמיד JSON תקין בפורמט הבא:
{
  "blocks": [
    { "type": "text", "content": "טקסט בעברית עם **הדגשות** לסכומים" },
    { "type": "table", "headers": ["כותרת1", "כותרת2"], "rows": [["ערך1", "ערך2"]] },
    { "type": "action", "action": "filter", "label": "טקסט כפתור", "payload": { "months": ["2026-01"], "categories": ["dining"] } },
    { "type": "action", "action": "navigate", "label": "טקסט כפתור", "payload": { "tab": "transactions" } }
  ]
}

סוגי בלוקים:
- text: טקסט תשובה בעברית. השתמש ב-markdown להדגשות.
- table: טבלת נתונים. headers = כותרות עמודות, rows = שורות נתונים.
- action/filter: כפתור שמסנן את הדשבורד. payload יכול לכלול months (מערך "YYYY-MM"), categories (מערך מזהי קטגוריות), amountMin, amountMax.
- action/navigate: כפתור שמנווט ללשונית. tab אחד מ: insights, cashflow, mapping, transactions.

כללים:
- תמיד החזר לפחות בלוק text אחד.
- הוסף table כשיש השוואה או רשימה של יותר מ-3 פריטים.
- הוסף action כשרלוונטי — לדוגמה אם המשתמש שואל על קטגוריה ספציפית, הוסף כפתור סינון.
- סכומים תמיד בפורמט ₪ עם מפריד אלפים.
- החזר רק JSON תקין, ללא טקסט לפני או אחרי ה-JSON.
`

let idCounter = 0
function nextId(): string {
  return `msg-${++idCounter}-${Date.now()}`
}

function parseAiResponse(raw: string): AiBlock[] | null {
  try {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    const json = raw.slice(start, end + 1)
    const parsed = JSON.parse(json) as AiResponse
    if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) return parsed.blocks
    return null
  } catch {
    return null
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return 'מפתח API לא תקין. בדוק בהגדרות.'
  if (error instanceof Anthropic.RateLimitError) return 'יותר מדי בקשות. נסה שוב בעוד דקה.'
  if (error instanceof Anthropic.APIError) return `שגיאת API: ${error.message}`
  if (error instanceof Error && error.message.includes('fetch')) return 'אין חיבור לשרת. בדוק את החיבור לאינטרנט.'
  return 'שגיאה לא צפויה. נסה שוב.'
}

export function useAiChat(input: UseAiChatInput) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const inputRef = useRef(input)

  // Keep refs in sync with latest values
  messagesRef.current = messages
  inputRef.current = input

  const clearMessages = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setIsLoading(false)
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    const apiKey = localStorage.getItem('anthropic-api-key')
    if (!apiKey || !text.trim()) return

    const model = localStorage.getItem('anthropic-model') || 'claude-haiku-4-5'

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text.trim() }
    const assistantMsg: ChatMessage = { id: nextId(), role: 'assistant', content: '', loading: true }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setIsLoading(true)

    try {
      const client = new Anthropic({ apiKey, baseURL: '/anthropic', dangerouslyAllowBrowser: true })

      const snapshot = buildDataSnapshot(inputRef.current)

      // Build conversation history from ref (avoids stale closure)
      const history = [...messagesRef.current, userMsg]
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.role === 'assistant' && m.blocks
            ? JSON.stringify({ blocks: m.blocks })
            : m.content,
        }))

      const abortController = new AbortController()
      abortRef.current = abortController

      // 30-second timeout if no tokens arrive
      let receivedTokens = false
      const timeoutId = setTimeout(() => {
        if (!receivedTokens) abortController.abort()
      }, 30_000)

      const stream = client.messages.stream({
        model,
        max_tokens: 2048,
        system: `להלן נתוני ההוצאות של המשתמש:\n\n${snapshot}\n\n---\n${SYSTEM_PROMPT_SUFFIX}`,
        messages: history,
      }, { signal: abortController.signal })

      let fullText = ''

      stream.on('text', (delta) => {
        receivedTokens = true
        fullText += delta
        setMessages(prev => prev.map(m =>
          m.id === assistantMsg.id ? { ...m, content: fullText } : m
        ))
      })

      await stream.finalMessage()
      clearTimeout(timeoutId)

      // Parse the complete response
      const blocks = parseAiResponse(fullText)

      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id
          ? {
              ...m,
              content: fullText,
              blocks: blocks ?? [{ type: 'text' as const, content: fullText }],
              loading: false,
            }
          : m
      ))
    } catch (error) {
      if (error instanceof Anthropic.APIUserAbortError) {
        setMessages(prev => [
          ...prev.filter(m => m.id !== assistantMsg.id),
          { id: nextId(), role: 'error', content: 'הבקשה נמשכה יותר מדי זמן. נסה שוב.' },
        ])
        setIsLoading(false)
        abortRef.current = null
        return
      }

      const errorText = getErrorMessage(error)
      setMessages(prev => [
        ...prev.filter(m => m.id !== assistantMsg.id),
        { id: nextId(), role: 'error', content: errorText },
      ])
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
  }, [])

  return { messages, isLoading, sendMessage, clearMessages }
}
