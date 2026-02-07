'use client';

import { useEffect } from 'react';
import { handleAuthCallback } from '@/lib/supabase-client';
import { toast } from 'sonner';

export function SupabaseCallbackHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash;
    if (
      hash &&
      (hash.includes('access_token=') || hash.includes('error=')) &&
      (hash.includes('refresh_token=') || hash.includes('type='))
    ) {
      const handleCallback = async () => {
        if (hash.includes('error=')) {
          const params = new URLSearchParams(hash.substring(1));
          const errorDescription =
            params.get('error_description') || params.get('error');
          toast.error(`Auth error: ${errorDescription}`);
          window.history.replaceState(
            null,
            document.title,
            window.location.pathname + window.location.search
          );
          return;
        }

        try {
          const session = await handleAuthCallback(hash);
          if (session) {
            toast.success('ACCOUNT CONFIRMED AND SIGNED IN');
            // Clean up the URL hash
            window.history.replaceState(
              null,
              document.title,
              window.location.pathname + window.location.search
            );
          }
        } catch (error) {
          console.error('Supabase callback error:', error);
          toast.error('FAILED TO COMPLETE AUTHENTICATION');
        }
      };

      handleCallback();
    }
  }, []);

  return null;
}
