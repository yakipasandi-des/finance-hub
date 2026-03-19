import { useState } from 'react'
import { Info } from 'lucide-react'

interface HelpTooltipProps {
  text: string
}

export function HelpTooltip({ text }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
    >
      <span
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          color: 'var(--text-faint)',
          cursor: 'default',
          userSelect: 'none',
          flexShrink: 0,
          transition: 'color 0.15s ease',
        }}
      >
        <Info size={14} strokeWidth={1.75} />
      </span>

      {visible && (
        <span
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            right: '50%',
            transform: 'translateX(50%)',
            background: 'var(--tooltip-bg)',
            color: 'var(--tooltip-text)',
            fontSize: '12px',
            fontWeight: 400,
            lineHeight: 1.6,
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            width: '220px',
            zIndex: 300,
            boxShadow: 'var(--shadow-lg)',
            direction: 'rtl',
            textAlign: 'right',
            pointerEvents: 'none',
          }}
        >
          {text}
          {/* arrow */}
          <span
            style={{
              position: 'absolute',
              bottom: '-4px',
              right: '50%',
              transform: 'translateX(50%) rotate(45deg)',
              width: '8px',
              height: '8px',
              background: 'var(--tooltip-bg)',
            }}
          />
        </span>
      )}
    </span>
  )
}
