/**
 * Rule-based scoring engine — no external AI API required.
 * Evaluates 5 signals from social profile data and returns a weighted score.
 */

function scoreAccountAge(data) {
  // Look for account age signals across platforms
  const allData = [data.instagram_data, data.facebook_data, data.tiktok_data, data.linkedin_data]
    .filter(Boolean)

  if (allData.length === 0) return 60

  let maxScore = 0
  for (const profile of allData) {
    const createdAt = profile.created_at || profile.account_created || profile.joined_date
    if (createdAt) {
      const ageMs = Date.now() - new Date(createdAt).getTime()
      const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30)
      if (ageMonths >= 12) maxScore = Math.max(maxScore, 85)
      else if (ageMonths >= 6) maxScore = Math.max(maxScore, 65)
      else maxScore = Math.max(maxScore, 30)
    } else {
      // No date data available — check follower count as a proxy for established account
      const followers = profile.followers_count || profile.follower_count || profile.followersCount || 0
      if (followers > 500) maxScore = Math.max(maxScore, 75)
      else if (followers > 100) maxScore = Math.max(maxScore, 65)
      else maxScore = Math.max(maxScore, 55)
    }
  }
  return maxScore || 60
}

function scorePostingActivity(data) {
  const igData = data.instagram_data
  const ttData = data.tiktok_data
  const fbData = data.facebook_data

  let signals = []

  if (igData) {
    const mediaCount = igData.media_count || igData.mediaCount || 0
    if (mediaCount >= 50) signals.push(90)
    else if (mediaCount >= 15) signals.push(75)
    else if (mediaCount >= 5) signals.push(55)
    else if (mediaCount > 0) signals.push(40)
    else signals.push(20)
  }

  if (ttData) {
    const videoCount = ttData.video_count || ttData.videoCount || 0
    if (videoCount >= 20) signals.push(90)
    else if (videoCount >= 5) signals.push(70)
    else if (videoCount > 0) signals.push(50)
    else signals.push(25)
  }

  if (fbData) {
    // Facebook gives limited data; presence itself is a signal
    signals.push(65)
  }

  if (signals.length === 0) return 55
  return Math.round(signals.reduce((a, b) => a + b, 0) / signals.length)
}

function scorePublicBehavior(data) {
  // We receive public bio/description text — check for red flags
  const textFields = []

  if (data.instagram_data?.biography) textFields.push(data.instagram_data.biography)
  if (data.tiktok_data?.bio_description) textFields.push(data.tiktok_data.bio_description)
  if (data.facebook_data?.bio) textFields.push(data.facebook_data.bio)
  if (data.linkedin_data?.headline) textFields.push(data.linkedin_data.headline)

  const combinedText = textFields.join(' ').toLowerCase()

  const redFlags = [
    /\bhate\b/, /\bviolenc/, /\bexplicit\b/, /\bnsfw\b/, /\bscam\b/, /\bfake\b/,
    /\bthreat/, /\b18\+\b/, /\badult content\b/,
  ]

  const positiveSignals = [
    /\bwork/, /\bhustle\b/, /\bprofessional\b/, /\bteam\b/, /\bservice\b/,
    /\bhard work/, /\bdedicated\b/, /\bfamily\b/, /\bcommunity\b/,
  ]

  let score = 75 // neutral baseline

  for (const flag of redFlags) {
    if (flag.test(combinedText)) {
      score -= 20
    }
  }

  for (const sig of positiveSignals) {
    if (sig.test(combinedText)) {
      score = Math.min(score + 5, 95)
    }
  }

  // No text data at all — neutral
  if (textFields.length === 0) return 70

  return Math.max(0, Math.min(100, score))
}

function scoreRealPersonSignals(data) {
  let score = 50
  let accountCount = 0

  const allData = [
    data.instagram_data,
    data.facebook_data,
    data.tiktok_data,
    data.linkedin_data,
  ].filter(Boolean)

  accountCount = allData.length

  // Multiple connected accounts = strong real person signal
  if (accountCount >= 3) score += 25
  else if (accountCount >= 2) score += 15
  else if (accountCount >= 1) score += 5

  // Profile picture present
  for (const profile of allData) {
    const hasPic = profile.profile_picture_url || profile.picture || profile.avatar_url ||
      profile.profilePictureUrl || profile.profile_pic_url
    if (hasPic) { score += 8; break }
  }

  // Has a display name / real name
  for (const profile of allData) {
    const hasName = profile.name || profile.display_name || profile.full_name ||
      profile.username || profile.displayName
    if (hasName) { score += 5; break }
  }

  // Followers/following ratio — bots often have 0 followers or very skewed ratios
  const igData = data.instagram_data
  if (igData) {
    const followers = igData.followers_count || 0
    const following = igData.follows_count || igData.following_count || 0
    if (followers > 50 && following > 10) score += 7
    else if (followers === 0 && following === 0) score -= 10
  }

  return Math.max(0, Math.min(100, score))
}

function scoreLocationMatch(applicantCity, applicantZip, data) {
  const textFields = []

  if (data.instagram_data?.biography) textFields.push(data.instagram_data.biography)
  if (data.tiktok_data?.bio_description) textFields.push(data.tiktok_data.bio_description)
  if (data.facebook_data?.location) textFields.push(JSON.stringify(data.facebook_data.location))
  if (data.linkedin_data?.localizedHeadline) textFields.push(data.linkedin_data.localizedHeadline)

  const combinedText = textFields.join(' ').toLowerCase()

  if (textFields.length === 0) return 60 // No location data — neutral per spec

  const city = (applicantCity || '').toLowerCase()
  const stateAbbrevs = [] // We accept all 50 states — no geo restriction

  if (city && combinedText.includes(city)) return 90

  // Check for state name in profile
  const usStates = [
    'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
    'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
    'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
    'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi',
    'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey',
    'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
    'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina',
    'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia',
    'washington', 'west virginia', 'wisconsin', 'wyoming',
  ]

  for (const state of usStates) {
    if (combinedText.includes(state)) return 70 // US-based, no exact match
  }

  return 60 // Data present but no clear location match
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { applicant, social } = req.body

  try {
    const account_age = scoreAccountAge(social)
    const posting_activity = scorePostingActivity(social)
    const public_behavior = scorePublicBehavior(social)
    const real_person_signals = scoreRealPersonSignals(social)
    const location_match = scoreLocationMatch(applicant.city, applicant.zip, social)

    // Weighted final score
    const final_score = Math.round(
      account_age * 0.25 +
      posting_activity * 0.20 +
      public_behavior * 0.25 +
      real_person_signals * 0.15 +
      location_match * 0.15
    )

    const status = final_score >= 75 ? 'confirmed' : 'declined'

    return res.status(200).json({
      account_age,
      posting_activity,
      public_behavior,
      real_person_signals,
      location_match,
      final_score,
      status,
    })
  } catch (err) {
    console.error('[score] Scoring error:', err)
    return res.status(200).json({
      account_age: 60,
      posting_activity: 60,
      public_behavior: 60,
      real_person_signals: 60,
      location_match: 60,
      final_score: 60,
      status: 'declined',
    })
  }
}
