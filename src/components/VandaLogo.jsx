const SIZE_MAP = {
  sm: { height: 36 },
  md: { height: 52 },
  lg: { height: 72 },
}

export default function VandaLogo({ size = 'md', onClick }) {
  const s = SIZE_MAP[size] || SIZE_MAP.md

  return (
    <img
      src="/logo.png"
      alt="V&A Workforce"
      onClick={onClick}
      style={{ height: s.height, width: 'auto' }}
      className={onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
    />
  )
}
