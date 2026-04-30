'use client';

import React, { useState } from 'react';
import { Mail, Shield, Disc3 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseBrowserClient } from '@/lib/supabase';

function getEmailRedirectUrl() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return `${window.location.origin}${basePath}/`;
}

export function AuthGate() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMagicLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setIsSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: getEmailRedirectUrl(),
        },
      });

      if (error) throw error;

      toast.success('Magic link sent', {
        description: 'Open the email on this device to sign in.',
      });
    } catch (error) {
      console.error(error);
      toast.error('Sign-in failed', {
        description: 'Check the email address and Supabase auth settings.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-background text-foreground px-6 py-10 flex items-center justify-center">
      <div className="w-full max-w-md border-4 border-border brutalist-shadow bg-card">
        <div className="border-b-4 border-border p-6 space-y-3">
          <div className="flex items-center gap-3">
            <Disc3 className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tighter">AlbumShelf</h1>
              <p className="text-xs font-mono text-muted-foreground uppercase">
                Account-synced library
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Sign in with a magic link to load your private collection from Supabase.
          </p>
        </div>

        <form onSubmit={handleMagicLink} className="p-6 space-y-4">
          <label className="space-y-2 block">
            <span className="text-xs font-mono uppercase text-muted-foreground">
              Email
            </span>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="rounded-none"
              required
            />
          </label>

          <Button
            type="submit"
            className="w-full rounded-none justify-center gap-2"
            disabled={isSubmitting}
          >
            <Mail className="h-4 w-4" />
            {isSubmitting ? 'Sending Link...' : 'Send Magic Link'}
          </Button>

          <div className="border border-border p-3 text-[10px] font-mono uppercase text-muted-foreground flex gap-2">
            <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              Each signed-in user gets a separate cloud-backed library. This replaces
              the old per-browser-only storage model.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
