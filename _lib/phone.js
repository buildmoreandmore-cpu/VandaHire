// Find a worker by phone number, handling any stored format
// When duplicates exist, prefers approved workers
export async function findByPhone(supabase, phone, select = 'id') {
  const digits = phone.replace(/\D/g, '').slice(-10)
  if (digits.length < 10) return null

  const area = digits.slice(0, 3)
  const prefix = digits.slice(3, 6)
  const line = digits.slice(6)

  // Ensure we always have status for sorting, even if caller didn't request it
  const needsStatus = !select.includes('status')
  const fullSelect = needsStatus ? `${select}, status` : select

  const { data, error } = await supabase
    .from('applicants')
    .select(fullSelect)
    .ilike('phone', `%${area}%${prefix}%${line}%`)
    .order('status', { ascending: true }) // 'approved' sorts before 'pending', 'rejected'
    .limit(1)

  if (error) throw error
  if (!data || data.length === 0) return null

  const result = data[0]
  if (needsStatus) delete result.status
  return result
}
