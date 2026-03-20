export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="logo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="logo-bar1" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>
        <linearGradient id="logo-bar2" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#fcd34d" />
        </linearGradient>
        <linearGradient id="logo-bar3" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#f9a8d4" />
        </linearGradient>
        <linearGradient id="logo-arrow" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="108" fill="url(#logo-bg)" />
      <rect x="112" y="260" width="72" height="148" rx="16" fill="url(#logo-bar1)" />
      <rect x="220" y="188" width="72" height="220" rx="16" fill="url(#logo-bar2)" />
      <rect x="328" y="136" width="72" height="272" rx="16" fill="url(#logo-bar3)" />
      <polyline
        points="148,240 256,172 364,116"
        fill="none"
        stroke="url(#logo-arrow)"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points="364,116 340,152 380,140" fill="white" opacity={0.95} />
    </svg>
  )
}
