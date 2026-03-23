import { useState, useEffect } from 'react'
import { useNavigate } from '../Router.jsx'
import Footer from '../components/Footer.jsx'
import VandaLogo from '../components/VandaLogo.jsx'

const STATUS_STYLES = {
  pending:          { label: 'Pending Review',   color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30' },
  approved:         { label: 'Approved',         color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/30' },
  awaiting_payment: { label: 'Awaiting Payment', color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/30' },
  staffing:         { label: 'Staffing Your Event', color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/30' },
  confirmed:        { label: 'Fully Staffed',    color: 'text-[#ffffff]',  bg: 'bg-[#ffffff]/10 border-[#ffffff]/30' },
  completed:        { label: 'Completed',        color: 'text-[#888]',     bg: 'bg-white/5 border-white/10' },
  cancelled:        { label: 'Cancelled',        color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/30' },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { label: status, color: 'text-white', bg: 'border-[#2a2a2a]' }
  return <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${s.color} ${s.bg}`}>{s.label}</span>
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

// ─── SERVICE AGREEMENT ──────────────────────────────────────────────────────

function ServiceAgreement({ event, onAccept, loading }) {
  const [signerName, setSignerName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const deposit = parseFloat(event.deposit_amount || 0)
  const balance = parseFloat(event.balance_amount || 0)
  const total = parseFloat(event.total_bill_amount || 0)

  return (
    <div className="border border-[#2a2a2a] rounded-2xl p-6 mt-6">
      <h3 className="text-lg font-bold mb-4">Service Agreement</h3>
      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5 max-h-96 overflow-y-auto text-sm text-[#aaa] leading-relaxed space-y-4">
        <p className="text-white font-bold text-base">V&A Hire Staffing Services Agreement</p>
        <p>This Service Agreement ("Agreement") is entered into between <strong>Varist and Associates of GA LLC</strong> ("Company," "we," "us") and the undersigned event organizer ("Client," "you") upon acceptance.</p>

        <p className="text-white font-semibold">1. Scope of Services</p>
        <p>V&A Hire will provide temporary staffing personnel ("Workers") for Client's event as described in the accepted quote. V&A Hire retains sole discretion over worker selection, assignment, and management. Workers are employees or contractors of V&A Hire, not of Client.</p>

        <p className="text-white font-semibold">2. Payment Terms</p>
        <p><strong>Deposit:</strong> A non-refundable deposit of <strong>${deposit > 0 ? `$${deposit.toFixed(2)}` : 'the quoted amount'}</strong> is due upon acceptance of this Agreement. Staffing will not commence until the deposit is received.</p>
        <p><strong>Balance:</strong> The remaining balance of <strong>${balance > 0 ? `$${balance.toFixed(2)}` : 'the quoted amount'}</strong> is due Net 15 (fifteen calendar days after the event date). By accepting this Agreement, Client <strong>expressly authorizes V&A Hire to automatically charge the payment method on file</strong> for the balance amount on or after the Net 15 due date without further notice or consent.</p>
        <p><strong>Late Fees:</strong> Unpaid balances will incur a late fee of 2% per week, compounding, up to a maximum of 10% of the outstanding balance.</p>

        <p className="text-white font-semibold">3. Card Authorization & Future Charges</p>
        <p>By providing payment information and accepting this Agreement, Client authorizes V&A Hire to: (a) charge the deposit amount immediately; (b) store the payment method securely for future charges; (c) automatically charge the balance amount on or after the Net 15 due date; (d) charge any applicable late fees, penalties, or additional charges incurred under this Agreement. This authorization remains in effect until all obligations under this Agreement are fulfilled.</p>

        <p className="text-white font-semibold">4. Non-Dispute & Chargeback Policy</p>
        <p>Client agrees <strong>not to initiate any chargebacks, payment disputes, or reversals</strong> with their bank, credit card company, or payment processor for any charges made under this Agreement. If Client files a chargeback or dispute, Client agrees to pay: (a) the full original charge amount; (b) a $50 chargeback administration fee; (c) all costs incurred by V&A Hire in responding to the dispute, including attorney's fees. Any disputed amount that is reversed shall remain a valid debt owed by Client.</p>

        <p className="text-white font-semibold">5. Cancellation & Refund Policy</p>
        <p>Client may cancel this Agreement subject to the following refund schedule based on notice provided before the event date:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>7+ days: 95% refund of deposit (5% processing fee retained)</li>
          <li>3-6 days: 50% refund of deposit</li>
          <li>24-72 hours: 25% refund of deposit</li>
          <li>Less than 24 hours: No refund</li>
        </ul>
        <p>Balance payments are non-refundable once services have been rendered.</p>

        <p className="text-white font-semibold">6. Limitation of Liability</p>
        <p>V&A Hire's total liability for any claims arising under this Agreement shall not exceed the total amount paid by Client. <strong>In no event shall V&A Hire be liable for any indirect, incidental, consequential, special, or punitive damages</strong>, including but not limited to lost profits, lost revenue, business interruption, or damage to reputation, regardless of the cause of action or theory of liability.</p>

        <p className="text-white font-semibold">7. Indemnification</p>
        <p>Client agrees to <strong>indemnify, defend, and hold harmless</strong> V&A Hire, its officers, directors, employees, agents, and contractors from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorney's fees) arising from or related to: (a) Client's event, venue, or premises; (b) Client's negligence or willful misconduct; (c) any injury to persons or damage to property at the event venue; (d) Client's breach of this Agreement; (e) any third-party claims related to the event.</p>

        <p className="text-white font-semibold">8. Venue Safety & Working Conditions</p>
        <p>Client is solely responsible for providing a safe working environment for all Workers. V&A Hire reserves the right to immediately withdraw Workers from any unsafe conditions, and Client shall be responsible for full payment for the scheduled shift. Client shall not require Workers to perform tasks outside the agreed scope of work or that violate any applicable laws or safety regulations.</p>

        <p className="text-white font-semibold">9. Non-Solicitation</p>
        <p>Client agrees not to directly hire, contract with, or solicit any V&A Hire Worker for a period of twelve (12) months following any event at which the Worker was placed by V&A Hire. If Client breaches this provision, Client shall pay a placement fee equal to 25% of the Worker's annualized compensation or $5,000, whichever is greater.</p>

        <p className="text-white font-semibold">10. Collection & Enforcement</p>
        <p>If Client fails to pay any amount due under this Agreement, V&A Hire may: (a) assess late fees as described above; (b) report the delinquency to credit bureaus; (c) engage collection agencies, with all collection costs borne by Client; (d) <strong>file a mechanic's lien, judgment lien, or UCC lien</strong> against Client's business assets; (e) pursue legal action in any court of competent jurisdiction. Client agrees to pay all costs of collection, including reasonable <strong>attorney's fees, court costs, and filing fees</strong>.</p>

        <p className="text-white font-semibold">11. Governing Law & Jurisdiction</p>
        <p>This Agreement shall be governed by and construed in accordance with the laws of the <strong>State of Georgia</strong>. Any disputes arising under this Agreement shall be resolved exclusively in the state or federal courts located in Fulton County, Georgia. Client consents to personal jurisdiction in such courts.</p>

        <p className="text-white font-semibold">12. Prevailing Party Attorney's Fees</p>
        <p>In any legal action or proceeding arising under this Agreement, the <strong>prevailing party shall be entitled to recover reasonable attorney's fees</strong>, expert witness fees, court costs, and all other costs and expenses incurred.</p>

        <p className="text-white font-semibold">13. Force Majeure</p>
        <p>Neither party shall be liable for failure to perform obligations due to acts of God, government orders, natural disasters, pandemics, civil unrest, or other circumstances beyond reasonable control. In such events, obligations shall be suspended for the duration of the force majeure event.</p>

        <p className="text-white font-semibold">14. Entire Agreement</p>
        <p>This Agreement constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, or agreements. No modification shall be effective unless in writing and signed by both parties. If any provision is found unenforceable, the remaining provisions shall continue in full force.</p>

        <p className="text-[#666] text-xs mt-6">Varist and Associates of GA LLC • 196 Peachtree St SW, #121, Atlanta, GA 30303 • vandahire.com</p>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="block text-sm text-[#777] mb-2">Full Legal Name (Signer)</label>
          <input
            type="text"
            value={signerName}
            onChange={e => setSignerName(e.target.value)}
            placeholder="John Smith"
            className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-[#555] focus:outline-none focus:border-[#ffffff]"
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            className="mt-1 w-5 h-5 accent-[#ffffff]"
          />
          <span className="text-sm text-[#aaa] leading-relaxed">
            I have read and agree to the V&A Hire Service Agreement. I authorize V&A Hire to charge my payment method for the deposit now and the balance on the Net 15 due date. I understand this creates a binding legal obligation.
          </span>
        </label>

        <button
          onClick={() => onAccept(signerName)}
          disabled={!signerName.trim() || !agreed || loading}
          className="w-full bg-[#ffffff] text-black rounded-xl py-4 font-bold text-lg hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing…' : `Accept & Pay Deposit — $${deposit.toFixed(2)}`}
        </button>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function OrganizerPortalPage({ token: routeToken } = {}) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Auto-load event from URL token (/pay/TOKEN) or query params (?event=ID)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'deposit_success') {
      setSuccessMsg('Deposit payment received! We\'re now staffing your event.')
    }
    if (params.get('payment') === 'balance_success') {
      setSuccessMsg('Balance payment received! Thank you.')
    }

    // Load event by token (from /pay/TOKEN route) or by event ID (legacy ?event=ID)
    const lookupToken = routeToken
    const eventId = params.get('event')
    if (lookupToken || eventId) {
      setLoading(true)
      const url = lookupToken
        ? `/api/accept-quote?token=${lookupToken}`
        : `/api/accept-quote?event_id=${eventId}`
      fetch(url)
        .then(r => r.json())
        .then(data => {
          if (data && data.id) {
            setResults({ events: [data] })
            if (data.contact_email) setEmail(data.contact_email)
          } else {
            setError('Event not found.')
          }
        })
        .catch(() => setError('Could not load event.'))
        .finally(() => setLoading(false))
    }
  }, [routeToken])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResults(null)
    if (!email.includes('@')) { setError('Please enter a valid email address.'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/status?type=organizer&email=${encodeURIComponent(email.trim())}`)
      const data = await res.json()
      setResults(data)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptAndPay = async (eventId, signerName) => {
    setPayLoading(true)
    setError('')
    try {
      const res = await fetch('/api/accept-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, signer_name: signerName, signer_email: email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Payment setup failed'); setPayLoading(false); return }
      // Redirect to Stripe checkout
      window.location.href = data.checkout_url
    } catch {
      setError('Payment setup failed. Please try again.')
      setPayLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <div className="px-6 pt-8 flex items-center justify-between max-w-3xl mx-auto w-full">
        <VandaLogo onClick={() => navigate('/')} />
        <a href="/admin" className="text-p-link text-sm hover:text-white transition-colors">Coordinator Login</a>
      </div>

      <div className="flex-1 px-6 py-16 max-w-3xl mx-auto w-full">
        <h1 className="text-4xl font-extrabold tracking-tighter mb-2">Organizer Portal</h1>
        <p className="text-[#888] mb-10">Enter the email you used when requesting staff to view your events and make payments.</p>

        {successMsg && (
          <div className="bg-[#ffffff]/10 border border-[#ffffff]/30 text-[#ffffff] rounded-xl p-4 mb-6 font-semibold">
            {successMsg}
          </div>
        )}

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
          <div>
            <label className="block text-sm text-[#777] mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-[#555] focus:outline-none focus:border-[#ffffff] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#ffffff] text-black rounded-full py-3 px-8 font-semibold hover:opacity-90 transition-all duration-200 disabled:opacity-50"
          >
            {loading ? 'Looking up…' : 'View My Events →'}
          </button>
        </form>

        {results?.events?.length > 0 && (
          <div className="mt-10 space-y-6">
            <p className="text-[#555] text-sm">{results.events.length} event{results.events.length !== 1 ? 's' : ''} found</p>
            {results.events.map((ev) => {
              const deposit = parseFloat(ev.deposit_amount || 0)
              const balance = parseFloat(ev.balance_amount || 0)
              const total = parseFloat(ev.total_bill_amount || 0)
              const depositPaid = ev.deposit_status === 'paid'
              const balancePaid = ev.payment_status === 'paid'
              const needsDeposit = total > 0 && !depositPaid && ev.status !== 'cancelled'
              const needsBalance = depositPaid && !balancePaid && ev.status !== 'cancelled'
              const agreementSigned = !!ev.agreement_accepted_at

              return (
                <div key={ev.id} className="border border-[#2a2a2a] rounded-2xl overflow-hidden">
                  {/* Event header */}
                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                      <div>
                        <div className="font-bold text-white text-lg">{ev.title}</div>
                        <div className="text-[#666] text-sm mt-1">
                          {formatDate(ev.event_date)} • {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
                        </div>
                        <div className="text-[#555] text-sm mt-1">{ev.location}, {ev.city}</div>
                      </div>
                      <StatusBadge status={ev.status} />
                    </div>

                    {/* Pricing summary (simplified — no internal breakdown) */}
                    {total > 0 && (
                      <div className="bg-[#111] rounded-xl p-4 mt-3">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[#888] text-sm">Staffing Fee</span>
                          <span className="text-white font-bold text-xl">${total.toFixed(2)}</span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div className="flex-1 bg-[#0a0a0a] rounded-lg p-3 text-center">
                            <div className="text-[#666] text-xs mb-1">Deposit</div>
                            <div className={`font-bold ${depositPaid ? 'text-[#ffffff]' : 'text-white'}`}>
                              ${deposit.toFixed(2)}
                            </div>
                            {depositPaid && <div className="text-[#ffffff] text-xs mt-1">Paid ✓</div>}
                          </div>
                          <div className="flex-1 bg-[#0a0a0a] rounded-lg p-3 text-center">
                            <div className="text-[#666] text-xs mb-1">Balance (Net 15)</div>
                            <div className={`font-bold ${balancePaid ? 'text-[#ffffff]' : 'text-white'}`}>
                              ${balance.toFixed(2)}
                            </div>
                            {balancePaid && <div className="text-[#ffffff] text-xs mt-1">Paid ✓</div>}
                            {needsBalance && ev.balance_due_date && (
                              <div className="text-[#888] text-xs mt-1">Due {ev.balance_due_date}</div>
                            )}
                          </div>
                        </div>

                        {/* Pay balance button */}
                        {needsBalance && ev.stripe_payment_url && (
                          <a
                            href={ev.stripe_payment_url}
                            className="block w-full bg-[#ffffff] text-black rounded-xl py-3 font-bold text-center mt-4 hover:opacity-90 transition-all"
                          >
                            Pay Balance — ${balance.toFixed(2)}
                          </a>
                        )}

                        {balancePaid && depositPaid && (
                          <div className="text-center text-[#ffffff] font-semibold mt-4 py-2">
                            All payments complete ✓
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Agreement + Pay Deposit (only if deposit not paid yet) */}
                  {needsDeposit && !agreementSigned && (
                    <div className="px-5 pb-5">
                      <ServiceAgreement
                        event={ev}
                        onAccept={(name) => handleAcceptAndPay(ev.id, name)}
                        loading={payLoading}
                      />
                    </div>
                  )}

                  {/* Deposit pending — already signed, show pay link */}
                  {needsDeposit && agreementSigned && ev.deposit_checkout_url && (
                    <div className="px-5 pb-5">
                      <a
                        href={ev.deposit_checkout_url}
                        className="block w-full bg-[#ffffff] text-black rounded-xl py-4 font-bold text-lg text-center hover:opacity-90 transition-all"
                      >
                        Pay Deposit — ${deposit.toFixed(2)}
                      </a>
                      <p className="text-[#555] text-xs text-center mt-2">Agreement accepted on {new Date(ev.agreement_accepted_at).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {results && (!results.events || results.events.length === 0) && (
          <div className="mt-10 border border-[#2a2a2a] rounded-2xl p-6">
            <div className="font-bold text-lg mb-2 text-[#888]">No Events Found</div>
            <p className="text-[#666] leading-relaxed mb-4">We couldn't find any events for that email.</p>
            <button onClick={() => navigate('/events')} className="bg-[#ffffff] text-black rounded-full py-2 px-6 font-semibold text-sm hover:opacity-90 transition-all">
              Submit a Staff Request →
            </button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
