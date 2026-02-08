'use client';

import { useMemo, useState } from 'react';
import { User, LogOut, CloudDownload, CloudUpload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  isSupabaseConfigured,
  signInWithPassword,
  signOut,
  signUpWithPassword,
} from '@/lib/supabase-client';
import { toast } from 'sonner';
import { useSync } from '@/hooks/use-sync';

export function SupabaseAuthPanel() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const {
    session,
    isSyncing,
    needsConflictResolution,
    pushToCloud,
    pullFromCloud,
    setSession,
  } = useSync();

  const isConfigured = isSupabaseConfigured();

  const handleAuth = async () => {
    if (!email || !password) {
      toast.error('Enter an email and password.');
      return;
    }
    setIsBusy(true);
    try {
      const nextSession =
        mode === 'sign-in'
          ? await signInWithPassword(email, password)
          : await signUpWithPassword(email, password);
      if (!nextSession) {
        toast.message('Check your email to confirm your account.');
        setMode('sign-in');
      } else {
        setSession(nextSession);
        toast.success('Signed in.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Authentication failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSignOut = async () => {
    setIsBusy(true);
    try {
      await signOut();
      setSession(null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to sign out.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleManualPush = async () => {
    setIsBusy(true);
    const success = await pushToCloud();
    if (success) {
      toast.success('Uploaded to cloud.');
    } else {
      toast.error('Upload failed.');
    }
    setIsBusy(false);
  };

  const handleManualPull = async () => {
    setIsBusy(true);
    const success = await pullFromCloud();
    if (success) {
      toast.success('Loaded from cloud.');
    } else {
      toast.error('Download failed.');
    }
    setIsBusy(false);
  };

  const buttonLabel = useMemo(() => {
    if (!session) return 'ACCOUNT';
    return session.user.email ? `ACCOUNT: ${session.user.email}` : 'ACCOUNT';
  }, [session]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-12 border-2 border-border uppercase tracking-tight"
        onClick={() => setOpen(true)}
      >
        <User className="mr-2 h-4 w-4" />
        {buttonLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px] border-4 border-primary brutalist-shadow">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">
              Cloud Account
            </DialogTitle>
            <DialogDescription className="text-xs font-mono uppercase">
              Sign in to sync your library across devices.
            </DialogDescription>
          </DialogHeader>

          {!isConfigured ? (
            <div className="text-xs font-mono uppercase text-muted-foreground">
              Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and
              NEXT_PUBLIC_SUPABASE_ANON_KEY to enable cloud sync.
            </div>
          ) : session ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono uppercase">
                  Signed in as {session.user.email ?? session.user.id}
                </div>
                {(isSyncing || isBusy) && (
                  <div className="text-[10px] font-mono uppercase animate-pulse text-primary">
                    Syncing...
                  </div>
                )}
              </div>
              {needsConflictResolution && (
                <div className="rounded-md border-2 border-border p-3 text-xs font-mono uppercase">
                  Cloud data exists. Choose which version to keep.
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleManualPull}
                  variant="outline"
                  className="border-2 border-border"
                  disabled={isBusy || isSyncing}
                >
                  <CloudDownload className="mr-2 h-4 w-4" />
                  Pull from cloud
                </Button>
                <Button
                  onClick={handleManualPush}
                  variant="outline"
                  className="border-2 border-border"
                  disabled={isBusy || isSyncing}
                >
                  <CloudUpload className="mr-2 h-4 w-4" />
                  Push to cloud
                </Button>
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  className="border-2 border-border"
                  disabled={isBusy || isSyncing}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3">
                <Input
                  type="email"
                  placeholder="EMAIL"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="border-2 border-border uppercase tracking-tight"
                  maxLength={200}
                />
                <Input
                  type="password"
                  placeholder="PASSWORD"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border-2 border-border uppercase tracking-tight"
                  maxLength={100}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleAuth}
                  disabled={isBusy}
                  className="uppercase tracking-tight"
                >
                  {mode === 'sign-in' ? 'Sign in' : 'Sign up'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
                  }
                  className="border-2 border-border uppercase tracking-tight"
                  disabled={isBusy}
                >
                  Switch to {mode === 'sign-in' ? 'sign up' : 'sign in'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
