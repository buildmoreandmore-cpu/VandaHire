// Print-friendly blank application for in-person hiring events.
// Open at /apply-print, then Print → "Save as PDF" (or print copies).
// Includes a QR so applicants can also apply on their own phone.
export default function ApplyPrintPage() {
  const box = { border: '1px solid #000', height: 22, borderRadius: 3 }
  const line = { borderBottom: '1px solid #000', height: 20 }
  const chk = () => <span style={{ display: 'inline-block', width: 13, height: 13, border: '1px solid #000', marginRight: 5, verticalAlign: 'middle' }} />
  const Field = ({ label, w = '100%' }) => (
    <div style={{ width: w, boxSizing: 'border-box', paddingRight: 10, marginBottom: 12 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: '#333', marginBottom: 3 }}>{label}</div>
      <div style={line} />
    </div>
  )
  const roles = ['Janitorial', 'Cleanup', 'Setup & Breakdown', 'Brand Activation', 'General Labor']
  const avail = ['Weekdays', 'Weekends', 'On-Call']
  const windows = ['Mornings (6a–12p)', 'Afternoons (12–5p)', 'Evenings (5–10p)', 'Overnight (10p–6a)', 'Flexible / Any']
  const exp = ['Event Staffing', 'Warehouse', 'Food Service', 'Retail', 'Cleaning', 'Moving / Labor', 'Security', 'No Experience Yet']

  return (
    <div style={{ background: '#fff', color: '#000', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <style>{`@media print { .no-print { display:none !important } @page { margin: 0.5in } }`}</style>
      <div className="no-print" style={{ background: '#111', padding: '10px 16px', textAlign: 'center' }}>
        <button onClick={() => window.print()} style={{ background: '#fff', color: '#000', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 700, cursor: 'pointer' }}>Print / Save as PDF</button>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>V&amp;A Hire — Job Application</div>
            <div style={{ fontSize: 11, color: '#444' }}>Varist &amp; Associates of Georgia LLC · vandahire.com</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=https://vandahire.com/apply" alt="Apply online" width="90" height="90" />
            <div style={{ fontSize: 9, color: '#444', width: 96 }}>Or apply on your phone</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          <Field label="First name" w="50%" />
          <Field label="Last name" w="50%" />
          <Field label="Phone (for your ID/W-9 link)" w="50%" />
          <Field label="Email" w="50%" />
          <Field label="City" w="50%" />
          <Field label="Zip" w="50%" />
        </div>

        <Section title="Roles you can work (check all)">
          {roles.map(r => <label key={r} style={{ display: 'inline-block', width: '33%', fontSize: 12, marginBottom: 6 }}>{chk()}{r}</label>)}
        </Section>
        <Section title="Availability">
          {avail.map(r => <label key={r} style={{ display: 'inline-block', width: '33%', fontSize: 12, marginBottom: 6 }}>{chk()}{r}</label>)}
        </Section>
        <Section title="Preferred shift windows">
          {windows.map(r => <label key={r} style={{ display: 'inline-block', width: '33%', fontSize: 12, marginBottom: 6 }}>{chk()}{r}</label>)}
        </Section>
        <Section title="Experience (check all)">
          {exp.map(r => <label key={r} style={{ display: 'inline-block', width: '25%', fontSize: 12, marginBottom: 6 }}>{chk()}{r}</label>)}
        </Section>

        <div style={{ display: 'flex', gap: 24, marginTop: 6 }}>
          <div style={{ fontSize: 12 }}>Own transportation? {chk()}Yes &nbsp; {chk()}No</div>
          <div style={{ fontSize: 12 }}>Available on short notice? {chk()}Yes &nbsp; {chk()}Sometimes &nbsp; {chk()}No</div>
        </div>

        <div style={{ marginTop: 16, border: '1px solid #000', borderRadius: 4, padding: 10 }}>
          <label style={{ fontSize: 11, lineHeight: 1.5, display: 'block' }}>
            {chk()}<strong>SMS consent:</strong> By checking this box, I agree to receive SMS messages from V&amp;A Hire (Varist &amp; Associates of Georgia LLC)
            related to customer care, assignment confirmations, scheduling, shift details, status updates, and reminders. Reply STOP to opt out, HELP for help.
            Msg &amp; data rates may apply. Frequency varies. See vandahire.com/privacy and vandahire.com/terms.
          </label>
        </div>

        <div style={{ display: 'flex', gap: 20, marginTop: 20 }}>
          <div style={{ flex: 1 }}><div style={line} /><div style={{ fontSize: 10, color: '#333', marginTop: 3 }}>Signature</div></div>
          <div style={{ width: 160 }}><div style={line} /><div style={{ fontSize: 10, color: '#333', marginTop: 3 }}>Date</div></div>
        </div>

        <div style={{ marginTop: 16, fontSize: 10, color: '#555', borderTop: '1px solid #ccc', paddingTop: 8 }}>
          After you're entered, you'll get a text/email link to upload your <strong>Government ID</strong> and complete your <strong>W-9</strong>. Office use only below.
          <div style={{ marginTop: 6 }}>Entered by: ______________  ·  Date: __________  ·  ID/W-9 link sent: {chk()}</div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{title}</div>
      <div>{children}</div>
    </div>
  )
}
