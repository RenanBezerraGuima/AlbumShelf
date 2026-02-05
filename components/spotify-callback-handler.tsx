'use client';

import { useEffect } from 'react';
import { useFolderStore } from '@/lib/store';
import { parseSpotifyHash } from '@/lib/spotify-auth';
import { toast } from 'sonner';

export function SpotifyCallbackHandler() {
  const setSpotifyToken = useFolderStore((state) => state.setSpotifyToken);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const authData = parseSpotifyHash(hash);

      if (authData) {
        setSpotifyToken(authData.accessToken, authData.expiresIn, authData.timestamp);
        toast.success('CONNECTED TO SPOTIFY');

        // Clean up the URL hash
        window.history.replaceState(
          null,
          document.title,
          window.location.pathname + window.location.search
        );
      }
    }
  }, [setSpotifyToken]);

  return null;
}
