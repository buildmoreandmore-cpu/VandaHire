/**
 * TikTok OAuth callback
 */
export default async function handler(req, res) {
  const { code, error: oauthError, error_description } = req.query

  const closeWithError = (msg) => {
    return res.send(`<!DOCTYPE html><html><body><script>
      if (window.opener) {
        window.opener.postMessage({ type: 'PORTER_OAUTH_ERROR', platform: 'tiktok', error: '${msg}' }, '*');
      }
      window.close();
    </script></body></html>`)
  }

  if (oauthError || !code) {
    return closeWithError(error_description || oauthError || 'No code received')
  }

  try {
    const redirectUri = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/oauth/tiktok/callback`

    // Exchange code for token
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      console.error('[oauth/tiktok] Token exchange failed:', tokenData)
      return closeWithError('Token exchange failed')
    }

    // Fetch user info
    const profileRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,bio_description,profile_deep_link,video_count,follower_count,following_count,likes_count',
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    )
    const profileJson = await profileRes.json()
    const user = profileJson.data?.user || {}

    const profileData = {
      open_id: user.open_id,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      bio_description: user.bio_description,
      video_count: user.video_count || 0,
      follower_count: user.follower_count || 0,
      following_count: user.following_count || 0,
      likes_count: user.likes_count || 0,
    }

    const payload = JSON.stringify({ type: 'PORTER_OAUTH_SUCCESS', platform: 'tiktok', profileData })
    return res.send(`<!DOCTYPE html><html><body><script>
      if (window.opener) {
        window.opener.postMessage(${payload}, '*');
      }
      window.close();
    </script></body></html>`)
  } catch (err) {
    console.error('[oauth/tiktok] Error:', err)
    return closeWithError('Server error')
  }
}
