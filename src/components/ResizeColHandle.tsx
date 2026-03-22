import { useState } from 'react'

interface Props {
  handleStyle: React.CSSProperties
  lineStyle: React.CSSProperties
  lineHoverStyle: React.CSSProperties
  onMouseDown: (e: React.MouseEvent) => void
}

export function ResizeColHandle({ handleStyle, lineStyle, lineHoverStyle, onMouseDown }: Props) {
  const [hovered, setHovered] = useState(false)
  return (
    <span
      style={handleStyle}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={hovered ? lineHoverStyle : lineStyle} />
    </span>
  )
}
