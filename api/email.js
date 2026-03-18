import { Resend } from 'resend'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { first_name, email, status } = req.body

  if (!email || !first_name || !status) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'crew@joinporter.co'

  let subject, htmlBody, textBody

  if (status === 'confirmed') {
    subject = "You're in — here's what's next"

    textBody = `Hey ${first_name},

You're in. Welcome to Porter.

We'll text you when a shift near you opens up. Shifts move fast — first to reply gets the spot.

Here's what to expect:
- Shifts typically run 6–10 hours
- Pay is processed within 48 hours of your shift
- You'll always see the location, rate, and start time before you commit

Keep your phone close.

— Porter
crew@joinporter.co`

    htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're in — Porter</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:48px 32px;">
    <div style="margin-bottom:32px;">
      <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Porter</span>
    </div>

    <h1 style="color:#ffffff;font-size:32px;font-weight:800;margin:0 0 8px;letter-spacing:-0.5px;line-height:1.2;">
      You're in.
    </h1>
    <p style="color:#c8ff00;font-size:18px;font-weight:600;margin:0 0 32px;">
      Welcome to Porter, ${first_name}.
    </p>

    <p style="color:#cccccc;font-size:16px;line-height:1.7;margin:0 0 24px;">
      We'll text you when a shift near you opens up. Shifts move fast — first to reply gets the spot.
    </p>

    <div style="background:#141414;border:1px solid #222222;border-radius:16px;padding:24px;margin:0 0 32px;">
      <p style="color:#888888;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 16px;">What to expect</p>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <span style="color:#c8ff00;font-size:16px;margin-top:1px;">→</span>
          <p style="color:#cccccc;font-size:15px;margin:0;line-height:1.5;">Shifts typically run 6–10 hours</p>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <span style="color:#c8ff00;font-size:16px;margin-top:1px;">→</span>
          <p style="color:#cccccc;font-size:15px;margin:0;line-height:1.5;">Pay is processed within 48 hours of your shift</p>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <span style="color:#c8ff00;font-size:16px;margin-top:1px;">→</span>
          <p style="color:#cccccc;font-size:15px;margin:0;line-height:1.5;">You'll always see the location, rate, and start time before you commit</p>
        </div>
      </div>
    </div>

    <p style="color:#cccccc;font-size:16px;font-weight:600;margin:0 0 32px;">
      Keep your phone close.
    </p>

    <div style="border-top:1px solid #222222;padding-top:24px;margin-top:8px;">
      <p style="color:#555555;font-size:13px;margin:0;">— Porter</p>
      <a href="mailto:crew@joinporter.co" style="color:#555555;font-size:13px;text-decoration:none;">crew@joinporter.co</a>
    </div>
  </div>
</body>
</html>`

  } else {
    subject = 'Your Porter application'

    textBody = `Hey ${first_name},

Thanks for applying to Porter.

After reviewing your profile, we're not able to move forward at this time. This may be due to availability in your area, role fit, or profile eligibility.

You're welcome to reapply in 90 days.

— Porter
crew@joinporter.co`

    htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Porter application</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:48px 32px;">
    <div style="margin-bottom:32px;">
      <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Porter</span>
    </div>

    <h1 style="color:#ffffff;font-size:32px;font-weight:800;margin:0 0 24px;letter-spacing:-0.5px;line-height:1.2;">
      Hey ${first_name},
    </h1>

    <p style="color:#cccccc;font-size:16px;line-height:1.7;margin:0 0 16px;">
      Thanks for applying to Porter.
    </p>

    <p style="color:#cccccc;font-size:16px;line-height:1.7;margin:0 0 16px;">
      After reviewing your profile, we're not able to move forward at this time. This may be due to availability in your area, role fit, or profile eligibility.
    </p>

    <p style="color:#cccccc;font-size:16px;line-height:1.7;margin:0 0 32px;">
      You're welcome to reapply in 90 days.
    </p>

    <div style="border-top:1px solid #222222;padding-top:24px;margin-top:8px;">
      <p style="color:#555555;font-size:13px;margin:0;">— Porter</p>
      <a href="mailto:crew@joinporter.co" style="color:#555555;font-size:13px;text-decoration:none;">crew@joinporter.co</a>
    </div>
  </div>
</body>
</html>`
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `Porter <${fromEmail}>`,
      to: [email],
      subject,
      html: htmlBody,
      text: textBody,
    })

    if (error) {
      console.error('[email] Resend error:', error)
      return res.status(500).json({ error: 'Email failed', details: error })
    }

    return res.status(200).json({ success: true, emailId: data?.id })
  } catch (err) {
    console.error('[email] Unexpected error:', err)
    return res.status(500).json({ error: 'Email failed' })
  }
}
