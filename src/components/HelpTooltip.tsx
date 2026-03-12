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
          border: '1px solid #c0b8d8',
          color: 'var(--text-faint)',
          cursor: 'default',
          userSelect: 'none',
          flexShrink: 0,
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
            background: 'rgba(45,38,64,0.93)',
            color: '#f0edf8',
            fontSize: '12px',
            fontWeight: 400,
            lineHeight: 1.6,
            borderRadius: '8px',
            padding: '9px 13px',
            width: '220px',
            zIndex: 300,
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
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
              background: 'rgba(28,25,23,0.93)',
            }}
          />
        </span>
      )}
    </span>
  )
}
