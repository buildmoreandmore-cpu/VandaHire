// Find a worker by phone number, handling any stored format
// Returns the first matching applicant or null
export async function findByPhone(supabase, phone, select = 'id') {
  const digits = phone.replace(/\D/g, '').slice(-10)
  if (digits.length < 10) return null

  const area = digits.slice(0, 3)
  const prefix = digits.slice(3, 6)
  const line = digits.slice(6)

  const { data, error } = await supabase
    .from('applicants')
    .select(select)
    .ilike('phone', `%${area}%${prefix}%${line}%`)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}
