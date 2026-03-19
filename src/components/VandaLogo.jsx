const SIZE_MAP = {
  sm: { icon: 20, text: 'text-lg', gap: 'gap-1.5' },
  md: { icon: 26, text: 'text-2xl', gap: 'gap-2' },
  lg: { icon: 36, text: 'text-4xl', gap: 'gap-3' },
}

export default function VandaLogo({ size = 'md', onClick, showText = true }) {
  const s = SIZE_MAP[size] || SIZE_MAP.md
  const iconSize = s.icon

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center ${s.gap} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
    >
      {/* Inverted triangle funnel icon */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Funnel top bar */}
        <rect x="2" y="3" width="20" height="2.5" rx="1.25" fill="#3ecf8e" />
        {/* Funnel body (inverted triangle) */}
        <path d="M4 5.5L9.5 14.5H14.5L20 5.5H4Z" fill="#3ecf8e" />
        {/* Funnel stem */}
        <rect x="10.25" y="14.5" width="3.5" height="6.5" rx="1" fill="#3ecf8e" />
      </svg>

      {showText && (
        <span className={`text-white font-extrabold tracking-tight leading-none ${s.text}`}>
          Vanda
        </span>
      )}
    </span>
  )
}
