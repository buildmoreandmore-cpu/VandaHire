/**
 * Facebook OAuth callback
 */
export default async function handler(req, res) {
  const { code, error: oauthError } = req.query

  const closeWithError = (msg) => {
    return res.send(`<!DOCTYPE html><html><body><script>
      if (window.opener) {
        window.opener.postMessage({ type: 'PORTER_OAUTH_ERROR', platform: 'facebook', error: '${msg}' }, '*');
      }
      window.close();
    </script></body></html>`)
  }

  if (oauthError || !code) {
    return closeWithError(oauthError || 'No code received')
  }

  try {
    const redirectUri = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/oauth/facebook/callback`

    // Exchange code for token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${process.env.FACEBOOK_APP_SECRET}&code=${code}`
    )
    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      console.error('[oauth/facebook] Token exchange failed:', tokenData)
      return closeWithError('Token exchange failed')
    }

    // Fetch public profile
    const profileRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,picture.type(large)&access_token=${tokenData.access_token}`
    )
    const profile = await profileRes.json()

    const profileData = {
      id: profile.id,
      name: profile.name,
      picture: profile.picture?.data?.url || null,
    }

    const payload = JSON.stringify({ type: 'PORTER_OAUTH_SUCCESS', platform: 'facebook', profileData })
    return res.send(`<!DOCTYPE html><html><body><script>
      if (window.opener) {
        window.opener.postMessage(${payload}, '*');
      }
      window.close();
    </script></body></html>`)
  } catch (err) {
    console.error('[oauth/facebook] Error:', err)
    return closeWithError('Server error')
  }
}
