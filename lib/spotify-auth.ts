export const SPOTIFY_AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
export const SPOTIFY_SEARCH_ENDPOINT = "https://api.spotify.com/v1/search";

export const getSpotifyAuthUrl = () => {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || 'YOUR_SPOTIFY_CLIENT_ID';

  // Get the current origin and base path to construct the redirect URI
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  // Use the same logic as in next.config.mjs or a default
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/AlbumShelf';

  const redirectUri = `${origin}${basePath}`;

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
