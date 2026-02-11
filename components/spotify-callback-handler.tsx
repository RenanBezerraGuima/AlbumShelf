'use client';

import { useEffect } from 'react';
import { useFolderStore } from '@/lib/store';
import { parseSpotifyHash, exchangeCodeForToken } from '@/lib/spotify-auth';

export function SpotifyCallbackHandler() {
  const setSpotifyToken = useFolderStore((state) => state.setSpotifyToken);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleCallback = async () => {
      // 1. Handle Implicit Grant (Hash)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token=') && hash.includes('state=')) {
        const authData = parseSpotifyHash(hash);

        if (authData) {
          const storedState = localStorage.getItem('spotify_auth_state');
          localStorage.removeItem('spotify_auth_state');

          if (!authData.state || authData.state !== storedState) {
            console.error('Spotify Auth State Mismatch');
            window.history.replaceState(null, document.title, window.location.pathname);
            return;
          }

          setSpotifyToken(authData.accessToken, authData.expiresIn, authData.timestamp);

          // Clean up the URL hash
          window.history.replaceState(
            null,
            document.title,
            window.location.pathname + window.location.search
          );
          return;
        }
      }

      // 2. Handle PKCE (Search Params)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        localStorage.removeItem('spotify_auth_state');
        console.error('Spotify Auth Error:', error);

        // Clean up URL
        window.history.replaceState(
          null,
          document.title,
          window.location.pathname
        );
        return;
      }

      if (code) {
        const storedState = localStorage.getItem('spotify_auth_state');
        localStorage.removeItem('spotify_auth_state');

        if (!state || state !== storedState) {
          console.error('Spotify Auth State Mismatch');
          window.history.replaceState(null, document.title, window.location.pathname);
          return;
        }

        try {
          const data = await exchangeCodeForToken(code);
          if (data.access_token) {
            setSpotifyToken(data.access_token, data.expires_in, Date.now());

            // Clean up the URL
            window.history.replaceState(
              null,
              document.title,
              window.location.pathname
            );
          }
        } catch (err) {
          console.error('Failed to exchange code:', err);
        } finally {
          // Clean up sensitive temporary data
          localStorage.removeItem('spotify_code_verifier');
        }
      }
    };

    handleCallback();
  }, [setSpotifyToken]);

  return null;
}
