export default function ProgressBar({ step, total = 3 }) {
  const pct = Math.round((step / total) * 100)
  return (
    <div className="w-full h-[3px] bg-[#222]">
      <div
        className="h-full bg-[#c8ff00] transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
