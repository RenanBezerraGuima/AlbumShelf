export const SPOTIFY_AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
export const SPOTIFY_SEARCH_ENDPOINT = "https://api.spotify.com/v1/search";

const resolveBasePath = () => {
  if (process.env.NEXT_PUBLIC_BASE_PATH !== undefined) {
    return process.env.NEXT_PUBLIC_BASE_PATH;
  }

  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.pathname.startsWith('/AlbumShelf') ? '/AlbumShelf' : '';
};

const resolveRedirectUri = () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const basePath = resolveBasePath();
  const normalizedBasePath = basePath === '/' ? '' : basePath;

  let redirectUri = `${origin}${normalizedBasePath}`;
  if (!redirectUri.endsWith('/')) {
    redirectUri += '/';
  }
  return redirectUri;
};

function generateRandomString(length: number) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values)
    .map((x) => possible[x % possible.length])
    .join('');
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

  const redirectUri = resolveRedirectUri();

  const verifier = generateRandomString(128);
  const challenge = await generateCodeChallenge(verifier);
  const state = generateRandomString(16);

  localStorage.setItem('spotify_code_verifier', verifier);
  localStorage.setItem('spotify_auth_state', state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state: state,
    show_dialog: 'true',
  });

  window.location.href = `${SPOTIFY_AUTH_ENDPOINT}?${params.toString()}`;
};

export const exchangeCodeForToken = async (code: string) => {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || 'YOUR_SPOTIFY_CLIENT_ID';
  const redirectUri = resolveRedirectUri();
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

  const redirectUri = resolveRedirectUri();

  const state = generateRandomString(16);
  localStorage.setItem('spotify_auth_state', state);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    state: state,
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
  const state = params.get('state');

  if (!accessToken) return null;

  return {
    accessToken,
    expiresIn: expiresIn ? parseInt(expiresIn, 10) : 3600,
    timestamp: Date.now(),
    state
  };
};
