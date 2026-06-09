import { useNavigate } from '../Router.jsx'
import VandaLogo from '../components/VandaLogo.jsx'

export default function TermsOfServicePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <div className="px-6 pt-8 flex items-center justify-between max-w-5xl mx-auto w-full">
        <VandaLogo onClick={() => navigate('/')} />
      </div>

      <div className="max-w-3xl mx-auto w-full px-6 py-16">
        <div className="text-[#ffffff] font-semibold text-xs tracking-widest uppercase mb-4">Legal</div>
        <h1 className="text-4xl font-extrabold tracking-tighter mb-3">Terms of Service</h1>
        <p className="text-[#555] text-sm mb-12">Last updated: March 2025</p>

        <div className="space-y-10 text-[#999] text-sm leading-relaxed">

          <section>
            <h2 className="text-white font-bold text-lg mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using the V&A Hire platform — whether as a worker applicant or an event organizer — you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the platform.</p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">2. Platform Description</h2>
            <p className="mb-3">V&A Hire is a staffing coordination platform that connects vetted workers with event organizers who need temporary staffing support. V&A Hire acts as an intermediary — we review, approve, and dispatch workers; we do not employ workers directly.</p>
            <p>V&A Hire reserves the right to modify, suspend, or discontinue any aspect of the platform at any time without notice.</p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">3. Worker Terms</h2>
            <p className="mb-3">By submitting a worker application, you agree to the following:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>All information provided in your application is accurate and complete</li>
              <li>Applying does not guarantee placement. Shifts are offered based on location, availability, and fit</li>
              <li>If approved, you are responsible for showing up on time to assigned shifts in accordance with the instructions provided</li>
              <li>You will maintain professional conduct at all events you work through V&A Hire</li>
              <li>V&A Hire may remove you from the worker pool at any time for failure to meet standards, no-shows, or misconduct</li>
              <li>You consent to receive SMS messages from V&A Hire related to your application and shifts. Standard rates may apply</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">4. SMS / Text Messaging Program</h2>
            <p className="mb-3">By submitting our job application, you agree to receive recurring SMS text messages from V&A Hire (Varist &amp; Associates of Georgia LLC) at the mobile number you provide, including shift offers, assignment confirmations, scheduling, shift details, and check-in reminders.</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Message frequency varies based on shift activity.</li>
              <li>Message and data rates may apply.</li>
              <li>Reply <strong className="text-white">STOP</strong> to cancel at any time; reply <strong className="text-white">HELP</strong> for help.</li>
              <li>Consent to receive text messages is not a condition of employment or placement.</li>
              <li>Carriers are not liable for delayed or undelivered messages.</li>
              <li>We do not share or sell your mobile number or SMS consent with third parties for their marketing purposes. See our <a href="/privacy" className="underline hover:text-white">Privacy Policy</a>.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">5. Organizer Terms</h2>
            <p className="mb-3">By submitting an event staffing request, you agree to the following:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>All event details provided are accurate, including date, time, location, and staffing requirements</li>
              <li>You will communicate any changes to event details as soon as possible</li>
              <li>Payment of the service fee, once invoiced, is required to confirm staffing</li>
              <li>V&A Hire does not guarantee a specific number of workers if insufficient approved workers are available in your area or for your dates</li>
              <li>You are responsible for providing a safe working environment for all V&A Hire workers on site</li>
              <li>V&A Hire workers are not your employees. You may not direct them to perform tasks outside the scope of what was submitted in your staffing request</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">6. Payments</h2>
            <p className="mb-3">Service fees are charged to event organizers for confirmed staffing engagements. Fees are calculated based on the number of workers, hours, and roles requested.</p>
            <p>Payments are processed securely via Stripe. V&A Hire does not store payment card information. All fees are non-refundable once workers have been dispatched unless otherwise agreed in writing.</p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">7. Limitation of Liability</h2>
            <p className="mb-3">V&A Hire is a coordination and dispatch platform. We are not responsible for:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Worker performance, conduct, or actions while on site</li>
              <li>Any damages, losses, or injuries arising from events staffed through the platform</li>
              <li>Service interruptions, data loss, or errors on the platform</li>
            </ul>
            <p className="mt-3">To the maximum extent permitted by applicable law, V&A Hire&apos;s total liability shall not exceed the fees paid by the organizer for the specific engagement giving rise to the claim.</p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">8. Prohibited Conduct</h2>
            <p className="mb-3">You may not use the V&A Hire platform to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Provide false or misleading information</li>
              <li>Circumvent the platform to hire workers directly without paying the service fee</li>
              <li>Harass, threaten, or discriminate against workers or other users</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Interfere with the operation of the platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">9. Intellectual Property</h2>
            <p>All content, trademarks, and materials on the V&A Hire platform are owned by or licensed to V&A Hire. You may not reproduce, distribute, or create derivative works without our written permission.</p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">10. Governing Law</h2>
            <p>These Terms are governed by the laws of the State of Georgia, without regard to its conflict of law principles. Any disputes shall be resolved in the courts located in Fulton County, Georgia.</p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">11. Changes to These Terms</h2>
            <p>We may update these Terms from time to time. We will post updated Terms on this page with a revised effective date. Continued use of the platform after changes are posted constitutes acceptance of the updated Terms.</p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-[#1a1a1a] flex gap-6 text-sm text-[#555]">
          <button onClick={() => navigate('/privacy')} className="hover:text-white transition-colors">Privacy Policy</button>
          <button onClick={() => navigate('/')} className="hover:text-white transition-colors">Back to Home</button>
        </div>
      </div>
    </div>
  )
}
