import { sendSms } from './sms.js'
import { sendEmail } from './email.js'

// Create (or update) an applicant from an in-person intake and text/email them
// their ID + W-9 upload links. Shared by the coordinator and supervisor dashboards.
export async function createIntakeApplicant(supabase, b = {}) {
  const first_name = (b.first_name || '').trim()
  const phoneRaw = (b.phone || '').replace(/\D/g, '')
  if (!first_name || phoneRaw.length < 10) return { error: 'First name and a valid phone are required', status: 400 }
  const digits = phoneRaw.slice(-10)
  const emailAddr = (b.email || '').trim()

  const { data: existing } = await supabase.from('applicants').select('id').ilike('phone', `%${digits}%`).limit(1)
  // These text columns are NOT NULL — in-person often has only name+phone.
  const row = {
    first_name,
    last_name: (b.last_name || '').trim(),
    email: emailAddr,
    phone: digits,
    city: (b.city || '').trim(),
    zip: (b.zip || '').trim(),
    roles: b.roles || [],
    availability: b.availability || [],
    experience_types: b.experience_types || [],
    availability_windows: b.availability_windows || [],
    has_transportation: b.has_transportation || '',
    short_notice: b.short_notice || '',
    notes: b.notes || 'Added in person at a hiring event.',
    status: 'pending',
    source: b.source || 'in_person',
  }

  let applicantId
  if (existing && existing.length) {
    applicantId = existing[0].id
    await supabase.from('applicants').update(row).eq('id', applicantId)
  } else {
    const { data, error } = await supabase.from('applicants').insert(row).select('id').single()
    if (error) throw error
    applicantId = data.id
  }

  const site = 'https://vandahire.com'
  const idUrl = `${site}/id-upload/${digits}`
  const w9Url = `${site}/w9/${digits}`
  let smsSent = false, emailSent = false
  try { await sendSms(digits, `Welcome to V&A Hire, ${first_name}! Finish signing up — upload your ID: ${idUrl} and complete your W-9: ${w9Url}. Reply STOP to opt out.`); smsSent = true } catch (e) { console.error('[intake] sms', e.message) }
  if (emailAddr) {
    try {
      await sendEmail({
        to: emailAddr,
        subject: 'Finish your V&A Hire sign-up — ID + W-9',
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px"><h2>Welcome, ${first_name}!</h2><p>Thanks for signing up in person. Two quick steps to finish so you can be scheduled:</p><table style="width:100%;border-collapse:collapse;margin:14px 0"><tr><td style="padding:12px;border-bottom:1px solid #eee"><strong>1. Upload your ID</strong></td><td style="padding:12px;border-bottom:1px solid #eee;text-align:right"><a href="${idUrl}" style="background:#000;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Upload ID</a></td></tr><tr><td style="padding:12px"><strong>2. Complete your W-9</strong></td><td style="padding:12px;text-align:right"><a href="${w9Url}" style="background:#000;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Fill W-9</a></td></tr></table><p style="color:#888;font-size:12px">V&A Hire • vandahire.com</p></div>`,
      })
      emailSent = true
    } catch (e) { console.error('[intake] email', e.message) }
  }
  return { ok: true, id: applicantId, existed: !!(existing && existing.length), sms_sent: smsSent, email_sent: emailSent, id_url: idUrl, w9_url: w9Url }
}
