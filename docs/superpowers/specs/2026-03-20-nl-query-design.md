# Natural Language Query Feature — Design Spec

## Overview

A floating chat widget that lets users ask free-form questions about their spending in Hebrew. Claude analyzes pre-aggregated financial data and returns structured JSON responses rendered as text, tables, and actionable UI buttons.

**Scope:** Dev-only feature. The Vite proxy only works during `npm run dev`. The GitHub Pages deployment cannot proxy API calls. If production support is needed later, a Cloudflare Worker or similar edge proxy would be required.

## Architecture

### Components

| File | Purpose |
|------|---------|
| `src/components/ChatWidget.tsx` | Floating chat UI — collapsed button, expanded panel, message rendering |
| `src/hooks/useAiChat.ts` | Conversation state, system prompt construction, API calls, response parsing |
| `src/utils/buildDataSnapshot.ts` | Aggregates transactions/categories/budgets into a compact text summary |

### Mounting

`ChatWidget` is rendered inside `DashboardContent` (which is inside both `CategoriesProvider` and `FilterProvider`). It receives a callback prop `onNavigate` to change the active tab, and `onApplyFilter` to dispatch filter changes.

### Data Flow

```
User types question
        |
  ChatWidget component
        |
  useAiChat() hook  <-- builds data snapshot from existing contexts
        |                (FilterContext, CategoriesContext, budgets, map, etc.)
        |
  Anthropic SDK call
        |  POST /anthropic/v1/messages (via Vite dev proxy)
        |  system prompt = data snapshot + response schema
        |  messages = conversation history (max 10 messages = 5 user + 5 assistant)
        |  max_tokens = 2048
        |  streaming enabled
        |
  Structured JSON response (validated, fallback to raw text on parse failure)
        |
  ChatWidget renders blocks:
     - text    --> Hebrew markdown
     - table   --> styled HTML table
     - action  --> clickable button dispatching via onApplyFilter / onNavigate
```

## Data Sent to Claude

Each request includes a system prompt with a **pre-aggregated snapshot** (not raw transactions):

- Monthly totals by category (from `monthChartData`)
- Top merchants with summed amounts (capped at top 30 per category, long tail aggregated as "other")
- Category definitions (names, hierarchy, merchant mappings)
- Budget vs actual per category (if budgets set)
- Recurring vs variable totals and merchant list
- Current active filters

**Raw transactions** are always included as a bounded set — the most recent 100 transactions for the current filter period. This avoids fragile keyword detection while keeping token usage reasonable.

**Truncation strategy:** For large datasets (200+ merchants, 12+ months), `buildDataSnapshot` caps merchants at top 30 by total spend per category, and months at the most recent 12. Remaining data is aggregated into summary totals.

Estimated system prompt size: 1-3K tokens for a typical dataset, up to ~5K for large datasets.

## Response Schema

Claude returns structured JSON with an array of blocks:

```typescript
type AiResponse = {
  blocks: Array<
    | { type: 'text'; content: string }
    | { type: 'table'; headers: string[]; rows: string[][] }
    | { type: 'action'; action: 'filter'; label: string; payload: {
        months?: string[]
        categories?: string[]
        amountMin?: number
        amountMax?: number
      }}
    | { type: 'action'; action: 'navigate'; label: string; payload: {
        tab: 'insights' | 'cashflow' | 'mapping' | 'transactions'
      }}
  >
}
```

Action blocks include a `label` field — Claude generates the Hebrew button text (e.g., "הצג בדשבורד", "סנן לינואר").

**Example** — "כמה הוצאתי על מסעדות בינואר?":

```json
{
  "blocks": [
    { "type": "text", "content": "הוצאת **2,340₪** על מסעדות בינואר, עלייה של 15% לעומת דצמבר." },
    { "type": "table", "headers": ["בית עסק", "סכום"], "rows": [["שיפודי הכרמל", "890₪"], ["וולט", "650₪"], ["מקדונלדס", "800₪"]] },
    { "type": "action", "action": "filter", "label": "הצג עסקאות מסעדות בינואר", "payload": { "months": ["2026-01"], "categories": ["dining"] } }
  ]
}
```

### JSON Parsing & Fallback

1. Buffer the full streamed response, then extract the first `{...}` JSON block
2. Validate against the `AiResponse` schema
3. If parsing fails, render the raw response as a single text block — never show a broken UI

## Chat Widget UI

### Collapsed State

- Small circular button, bottom-left corner (left because RTL layout)
- Chat/sparkle icon
- High z-index above all dashboard content
- **Hidden when no API key is set** — the button only appears when `localStorage('anthropic-api-key')` has a value

### Expanded State

- Panel ~400px wide, ~500px tall, anchored bottom-left
- Overlays dashboard content — no layout shift
- Header: title ("שאל את Claude") + close button
- Message list: user messages and Claude responses, rendered block by block
- Input bar: text field + send button at the bottom
- Conversation persists while panel is open; cleared on close

### No Data State

If no transactions are loaded, the widget shows a message: "יש להעלות קבצים כדי להתחיל לשאול שאלות" (Upload files to start asking questions). The input is disabled.

### Loading & Streaming UX

- While waiting for Claude's response: a typing indicator (pulsing dots) appears in the message list
- Text is displayed progressively as tokens arrive (buffered until valid JSON can be extracted, then rendered block by block)
- If streaming takes longer than 30 seconds with no tokens, show a timeout message

## Error Handling

| Scenario | UI Behavior |
|----------|-------------|
| No API key | Widget button hidden entirely |
| Invalid API key (401) | Error message in chat: "מפתח API לא תקין. בדוק בהגדרות." |
| Rate limit (429) | Error message: "יותר מדי בקשות. נסה שוב בעוד דקה." |
| Network error | Error message: "אין חיבור לשרת. בדוק את החיבור לאינטרנט." |
| Malformed JSON response | Render raw response text as a single text block |
| Response truncated (max_tokens) | Render whatever was parsed; append "..." if incomplete |

Errors appear as styled messages in the chat — never crash or show raw error objects.

## Multi-Turn Conversation

- Conversation history sent to Claude on each request
- Capped at the last 10 messages (5 user + 5 assistant turns) to control token costs
- Enables follow-up questions like "ומה לגבי פברואר?"
- History cleared when widget is closed

## Model & Cost

- **Default model**: Claude Haiku 4.5 (`claude-haiku-4-5`) — fast, cheap, sufficient for structured data queries
- **Model selector in Settings** — options:
  - `claude-haiku-4-5` (default)
  - `claude-sonnet-4-6`
  - `claude-opus-4-6`
- **`max_tokens`**: 2048
- **Streaming** enabled for progressive response display
- **Estimated cost**: ~$0.001-0.005 per question (Haiku)

## Settings Integration

Added to the existing Settings tab (`SettingsTab.tsx`):

- **API key input** (already implemented) — stored in `localStorage('anthropic-api-key')`
- **Model selector** — dropdown with three options. Stored in `localStorage('anthropic-model')`

## Vite Proxy

Already configured in `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/anthropic': {
      target: 'https://api.anthropic.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/anthropic/, ''),
    },
  },
},
```

**Dev-only.** Does not work in production builds / GitHub Pages.

## Dependencies

- `@anthropic-ai/sdk` (already installed)
- No additional packages needed
