/**
 * Instagram OAuth callback
 * Exchanges code for access token → fetches basic profile → sends postMessage to opener
 */
export default async function handler(req, res) {
  const { code, error: oauthError } = req.query

  const closeWithError = (msg) => {
    return res.send(`<!DOCTYPE html><html><body><script>
      if (window.opener) {
        window.opener.postMessage({ type: 'PORTER_OAUTH_ERROR', platform: 'instagram', error: '${msg}' }, '*');
      }
      window.close();
    </script></body></html>`)
  }

  if (oauthError || !code) {
    return closeWithError(oauthError || 'No code received')
  }

  try {
    const redirectUri = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/oauth/instagram/callback`

    // Exchange code for short-lived access token
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_CLIENT_ID,
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      console.error('[oauth/instagram] Token exchange failed:', tokenData)
      return closeWithError('Token exchange failed')
    }

    // Fetch profile fields
    const profileRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${tokenData.access_token}`
    )
    const profile = await profileRes.json()

    const profileData = {
      id: profile.id,
      username: profile.username,
      account_type: profile.account_type,
      media_count: profile.media_count || 0,
    }

    const payload = JSON.stringify({ type: 'PORTER_OAUTH_SUCCESS', platform: 'instagram', profileData })
    return res.send(`<!DOCTYPE html><html><body><script>
      if (window.opener) {
        window.opener.postMessage(${payload}, '*');
      }
      window.close();
    </script></body></html>`)
  } catch (err) {
    console.error('[oauth/instagram] Error:', err)
    return closeWithError('Server error')
  }
}
