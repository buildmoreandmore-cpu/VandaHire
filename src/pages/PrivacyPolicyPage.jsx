import { useNavigate } from '../Router.jsx'
import VandaLogo from '../components/VandaLogo.jsx'

export default function PrivacyPolicyPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <div className="px-6 pt-8 flex items-center justify-between max-w-5xl mx-auto w-full">
        <VandaLogo onClick={() => navigate('/')} />
      </div>

      <div className="max-w-3xl mx-auto w-full px-6 py-16">
        <div className="text-[#16a34a] font-semibold text-xs tracking-widest uppercase mb-4">Legal</div>
        <h1 className="text-4xl font-extrabold tracking-tighter mb-3">Privacy Policy</h1>
        <p className="text-[#555] text-sm mb-12">Last updated: March 2025</p>

        <div className="space-y-10 text-[#999] text-sm leading-relaxed">

          <section>
            <h2 className="text-white font-bold text-lg mb-3">1. Information We Collect</h2>
            <p className="mb-3">When you apply for work through V&A Hire, we collect the information you provide in the application form, including your name, phone number, email address, location, availability, and any other details you submit.</p>
            <p className="mb-3">When event organizers submit a staffing request, we collect contact information, event details, and scheduling information provided in the request form.</p>
            <p>We may also collect limited technical data such as browser type and IP address when you access our platform, solely for security and operational purposes.</p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">2. How We Use Your Information</h2>
            <p className="mb-3">We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Review worker applications and determine eligibility for shifts</li>
              <li>Match approved workers with event staffing requests</li>
              <li>Send shift details, briefing information, and reminders via SMS or email</li>
              <li>Communicate with event organizers about their staffing requests</li>
              <li>Process payments for organizer service fees</li>
              <li>Send post-shift surveys to workers</li>
              <li>Maintain records for operational and compliance purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">3. SMS Communications</h2>
            <p className="mb-3">If you apply to work with V&A Hire, you may receive SMS messages regarding your application status, available shifts, shift details, and briefing reminders. Message frequency varies based on shift activity.</p>
            <p>Standard message and data rates may apply. You may opt out of SMS messages at any time by replying STOP to any message we send.</p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">4. Information Sharing</h2>
            <p className="mb-3">We do not sell your personal information to third parties. We may share information in the following limited circumstances:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-white">Event organizers:</strong> Worker names and shift-relevant details may be shared with the organizer or on-site supervisor for events you are assigned to</li>
              <li><strong className="text-white">Service providers:</strong> We use third-party services including Supabase (database), Twilio (SMS), Resend (email), and Stripe (payments). Each provider processes data per their own privacy policies</li>
              <li><strong className="text-white">Legal compliance:</strong> We may disclose information if required by law or to protect the rights, property, or safety of V&A Hire, our workers, or the public</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">5. Data Retention</h2>
            <p>We retain your information for as long as necessary to fulfill the purposes described in this policy, or as required by applicable law. Worker application data is retained for a minimum of one year to support shift history and eligibility records.</p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">6. Security</h2>
            <p>We implement reasonable technical and organizational measures to protect your information from unauthorized access, disclosure, or loss. No method of transmission over the internet is completely secure, and we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">7. Your Rights</h2>
            <p className="mb-3">You may request to access, correct, or delete your personal information by contacting us. We will respond to requests within a reasonable timeframe.</p>
            <p>If you are a California resident, you may have additional rights under the California Consumer Privacy Act (CCPA).</p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">8. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will post the updated policy on this page with a revised effective date. Continued use of our platform after changes are posted constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">9. Contact</h2>
            <p>If you have questions about this Privacy Policy or our data practices, you may contact us through the contact information provided on our platform.</p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-[#1a1a1a] flex gap-6 text-sm text-[#555]">
          <button onClick={() => navigate('/terms')} className="hover:text-white transition-colors">Terms of Service</button>
          <button onClick={() => navigate('/')} className="hover:text-white transition-colors">Back to Home</button>
        </div>
      </div>
    </div>
  )
}
