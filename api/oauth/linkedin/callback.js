/**
 * LinkedIn OAuth callback (OpenID Connect)
 */
export default async function handler(req, res) {
  const { code, error: oauthError, error_description } = req.query

  const closeWithError = (msg) => {
    return res.send(`<!DOCTYPE html><html><body><script>
      if (window.opener) {
        window.opener.postMessage({ type: 'PORTER_OAUTH_ERROR', platform: 'linkedin', error: '${msg}' }, '*');
      }
      window.close();
    </script></body></html>`)
  }

  if (oauthError || !code) {
    return closeWithError(error_description || oauthError || 'No code received')
  }

  try {
    const redirectUri = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/oauth/linkedin/callback`

    // Exchange code for token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      console.error('[oauth/linkedin] Token exchange failed:', tokenData)
      return closeWithError('Token exchange failed')
    }

    // Fetch profile via OpenID userinfo
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profile = await profileRes.json()

    const profileData = {
      sub: profile.sub,
      name: profile.name,
      given_name: profile.given_name,
      family_name: profile.family_name,
      picture: profile.picture,
      email: profile.email,
      locale: profile.locale,
    }

    const payload = JSON.stringify({ type: 'PORTER_OAUTH_SUCCESS', platform: 'linkedin', profileData })
    return res.send(`<!DOCTYPE html><html><body><script>
      if (window.opener) {
        window.opener.postMessage(${payload}, '*');
      }
      window.close();
    </script></body></html>`)
  } catch (err) {
    console.error('[oauth/linkedin] Error:', err)
    return closeWithError('Server error')
  }
}
