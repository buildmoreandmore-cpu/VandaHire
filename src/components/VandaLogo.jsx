const SIZE_MAP = {
  sm: { height: 48 },
  md: { height: 72 },
  lg: { height: 96 },
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
