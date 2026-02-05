export const SPOTIFY_AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
export const SPOTIFY_SEARCH_ENDPOINT = "https://api.spotify.com/v1/search";

function generateRandomString(length: number) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));

  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export const redirectToSpotifyAuth = async () => {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || 'YOUR_SPOTIFY_CLIENT_ID';

  if (clientId === 'YOUR_SPOTIFY_CLIENT_ID') {
    console.warn('Spotify Client ID is not configured. Please set NEXT_PUBLIC_SPOTIFY_CLIENT_ID environment variable.');
  }

  // Get the current origin and base path to construct the redirect URI
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  // Use the same logic as in next.config.mjs or a default
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/AlbumShelf';

  let redirectUri = `${origin}${basePath}`;
  if (!redirectUri.endsWith('/')) {
    redirectUri += '/';
  }

  const verifier = generateRandomString(128);
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem('spotify_code_verifier', verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    show_dialog: 'true',
  });

  window.location.href = `${SPOTIFY_AUTH_ENDPOINT}?${params.toString()}`;
};

export const exchangeCodeForToken = async (code: string) => {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || 'YOUR_SPOTIFY_CLIENT_ID';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/AlbumShelf';
  let redirectUri = `${origin}${basePath}`;
  if (!redirectUri.endsWith('/')) {
    redirectUri += '/';
  }
  const verifier = localStorage.getItem('spotify_code_verifier');

  const params = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier || '',
  });

  const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to exchange code for token');
  }

  return await response.json();
};

export const getSpotifyAuthUrl = () => {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || 'YOUR_SPOTIFY_CLIENT_ID';

  if (clientId === 'YOUR_SPOTIFY_CLIENT_ID') {
    console.warn('Spotify Client ID is not configured. Please set NEXT_PUBLIC_SPOTIFY_CLIENT_ID environment variable.');
  }

  // Get the current origin and base path to construct the redirect URI
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  // Use the same logic as in next.config.mjs or a default
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/AlbumShelf';

  let redirectUri = `${origin}${basePath}`;
  if (!redirectUri.endsWith('/')) {
    redirectUri += '/';
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    show_dialog: 'true',
    // We don't strictly need scopes for general album search,
    // but some metadata might be richer with a token.
  });

  return `${SPOTIFY_AUTH_ENDPOINT}?${params.toString()}`;
};

export const parseSpotifyHash = (hash: string) => {
  if (!hash) return null;

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const expiresIn = params.get('expires_in');

  if (!accessToken) return null;

  return {
    accessToken,
    expiresIn: expiresIn ? parseInt(expiresIn, 10) : 3600,
    timestamp: Date.now()
  };
};
