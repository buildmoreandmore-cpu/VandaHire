const SIZE_MAP = {
  sm: { icon: 32, vanda: 'text-lg', hire: 'text-[10px]', gap: 'gap-2' },
  md: { icon: 48, vanda: 'text-3xl', hire: 'text-xs', gap: 'gap-3' },
  lg: { icon: 64, vanda: 'text-5xl', hire: 'text-sm', gap: 'gap-4' },
}

export default function VandaLogo({ size = 'md', onClick, showTagline = false }) {
  const s = SIZE_MAP[size] || SIZE_MAP.md
  const iconSize = s.icon

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-start ${s.gap} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
    >
      {/* Funnel icon — outline/stroke style */}
      <svg
        width={iconSize}
        height={Math.round(iconSize * 1.25)}
        viewBox="0 0 48 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Top bar */}
        <line x1="4" y1="6" x2="44" y2="6" stroke="#3ecf8e" strokeWidth="3.5" strokeLinecap="round" />
        {/* Left diagonal */}
        <line x1="4" y1="6" x2="24" y2="38" stroke="#3ecf8e" strokeWidth="3.5" strokeLinecap="round" />
        {/* Right diagonal */}
        <line x1="44" y1="6" x2="24" y2="38" stroke="#3ecf8e" strokeWidth="3.5" strokeLinecap="round" />
        {/* Stem */}
        <line x1="24" y1="38" x2="24" y2="56" stroke="#3ecf8e" strokeWidth="3" strokeLinecap="round" />
      </svg>

      {/* Text block */}
      <span className="flex flex-col leading-none">
        <span className={`text-white font-extrabold tracking-tight ${s.vanda}`}>
          Vanda
        </span>
        <span className={`text-[#3ecf8e] font-bold tracking-[0.25em] uppercase mt-0.5 ${s.hire}`}>
          HIRE
        </span>
        {showTagline && (
          <>
            <span className="block w-full h-px bg-[#333] mt-2 mb-1.5" />
            <span className="text-[#666] text-xs font-normal tracking-normal">
              Show up. Get paid.
            </span>
          </>
        )}
      </span>
    </span>
  )
}
