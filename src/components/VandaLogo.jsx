const SIZE_MAP = {
  sm: { icon: 28, text: 'text-base', sub: 'text-[8px]', gap: 'gap-1.5' },
  md: { icon: 40, text: 'text-2xl', sub: 'text-[10px]', gap: 'gap-2' },
  lg: { icon: 56, text: 'text-4xl', sub: 'text-xs', gap: 'gap-3' },
}

export default function VandaLogo({ size = 'md', onClick }) {
  const s = SIZE_MAP[size] || SIZE_MAP.md
  const iconSize = s.icon

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center ${s.gap} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
    >
      {/* X& mark */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* X cross — two diagonal bars */}
        <line x1="6" y1="6" x2="42" y2="42" stroke="white" strokeWidth="5" strokeLinecap="round" />
        <line x1="42" y1="6" x2="6" y2="42" stroke="white" strokeWidth="5" strokeLinecap="round" />
        {/* & symbol tucked at bottom-right */}
        <text
          x="32"
          y="46"
          fill="#16a34a"
          fontSize="20"
          fontWeight="bold"
          fontFamily="Arial, sans-serif"
        >&amp;</text>
      </svg>

      {/* Text block */}
      <span className="flex flex-col leading-none">
        <span className={`text-white font-extrabold tracking-tight ${s.text}`}>
          V&amp;A
        </span>
        <span className={`text-[#16a34a] font-bold tracking-[0.25em] uppercase mt-0.5 ${s.sub}`}>
          HIRE
        </span>
      </span>
    </span>
  )
}
