export default function EventSubmittedScreen({ title }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-8">
        <svg className="w-20 h-20" viewBox="0 0 100 100" fill="none">
          <circle className="check-circle" cx="50" cy="50" r="46" stroke="#c8ff00" strokeWidth="4" strokeLinecap="round" />
          <polyline className="check-mark" points="30,52 44,66 70,38" stroke="#c8ff00" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>

      <h2 className="text-4xl font-extrabold text-white tracking-tight mb-3 fade-up">
        Request Submitted
      </h2>

      <p className="text-[#888] text-base leading-relaxed mb-2 fade-up-delay-1 max-w-sm">
        We've received your staffing request{title ? ` for "${title}"` : ''}.
      </p>
      <p className="text-[#888] text-base leading-relaxed mb-8 fade-up-delay-1 max-w-sm">
        Our team will review it and get back to you within 24 hours.
      </p>

      <a
        href="/"
        className="text-p-green text-sm font-medium hover:opacity-80 transition-opacity fade-up-delay-2"
      >
        ← Back to Porter
      </a>
    </div>
  )
}
