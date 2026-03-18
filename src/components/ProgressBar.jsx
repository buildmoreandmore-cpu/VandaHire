export default function ProgressBar({ step, total = 3 }) {
  const pct = Math.round((step / total) * 100)
  const complete = pct === 100

  return (
    <div className="w-full h-[3px] bg-[#1a1a1a] relative">
      <div
        className="h-full transition-all duration-500 ease-out relative"
        style={{
          width: `${pct}%`,
          background: complete
            ? '#c8ff00'
            : 'linear-gradient(90deg, #c8ff00 0%, #FF5C00 100%)',
        }}
      >
        {/* Glowing dot at tip */}
        {!complete && (
          <div
            className="progress-dot absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#FF5C00]"
          />
        )}
      </div>
    </div>
  )
}
