'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { useFolderStore, selectSyncState, applySyncState, type SyncState } from '@/lib/store';
import {
  fetchUserLibrary,
  getSession,
  isSupabaseConfigured,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  upsertUserLibrary,
  type SupabaseSession,
} from '@/lib/supabase-client';
import { toast } from 'sonner';
import { useRef } from 'react';

const emptySyncState = (state: SyncState) =>
  state.folders.length === 0;

export function SupabaseAuthPanel() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [remoteSnapshot, setRemoteSnapshot] = useState<SyncState | null>(null);
  const [needsConflictResolution, setNeedsConflictResolution] = useState(false);
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRequestedRemote = useRef(false);
  const isGitHubPages = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.location.hostname.endsWith('github.io'),
    []
  );

  const isConfigured = isSupabaseConfigured;

  useEffect(() => {
    if (!isConfigured) return;
    getSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, [isConfigured]);

  useEffect(() => {
    if (!session || !isConfigured) return;
    if (hasLoadedRemote) return;
    if (hasRequestedRemote.current) return;
    hasRequestedRemote.current = true;

    const loadRemote = async () => {
      try {
        const rows = await fetchUserLibrary(session.user.id);
        const remoteData = rows[0]?.data as SyncState | undefined;
        const currentLocalSyncState = selectSyncState(useFolderStore.getState());

        if (remoteData) {
          if (emptySyncState(currentLocalSyncState)) {
            applySyncState(remoteData);
            toast.success('Loaded your cloud library.');
          } else {
            setRemoteSnapshot(remoteData);
            setNeedsConflictResolution(true);
          }
        } else if (!emptySyncState(currentLocalSyncState)) {
          await upsertUserLibrary(session.user.id, currentLocalSyncState);
          toast.success('Uploaded your local library.');
        }
      } catch (error) {
        console.error(error);
        toast.error('Unable to reach Supabase. Check your config.');
      } finally {
        setHasLoadedRemote(true);
      }
    };

    loadRemote();
  }, [hasLoadedRemote, isConfigured, session]);

  useEffect(() => {
    if (!session || !isConfigured || !hasLoadedRemote) return;
    const unsubscribe = useFolderStore.subscribe(async (state) => {
      if (needsConflictResolution) return;
      const selectedState = selectSyncState(state);
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
      }
      syncTimer.current = setTimeout(async () => {
        try {
          await upsertUserLibrary(session.user.id, selectedState);
        } catch (error) {
          console.error(error);
        }
      }, 800);
    });

    return () => {
      unsubscribe();
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
      }
    };
  }, [hasLoadedRemote, isConfigured, needsConflictResolution, session]);

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
      setHasLoadedRemote(false);
      setNeedsConflictResolution(false);
      setRemoteSnapshot(null);
      hasRequestedRemote.current = false;
    } catch (error) {
      console.error(error);
      toast.error('Failed to sign out.');
    } finally {
      setIsBusy(false);
    }
  };

  const pushToCloud = async () => {
    if (!session) return;
    setIsBusy(true);
    try {
      const currentLocalSyncState = selectSyncState(useFolderStore.getState());
      await upsertUserLibrary(session.user.id, currentLocalSyncState);
      setNeedsConflictResolution(false);
      toast.success('Uploaded to cloud.');
    } catch (error) {
      console.error(error);
      toast.error('Upload failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const pullFromCloud = async () => {
    if (!session) return;
    setIsBusy(true);
    try {
      if (remoteSnapshot) {
        applySyncState(remoteSnapshot);
      } else {
        const rows = await fetchUserLibrary(session.user.id);
        const remoteData = rows[0]?.data as SyncState | undefined;
        if (remoteData) {
          applySyncState(remoteData);
          setRemoteSnapshot(remoteData);
        }
      }
      setNeedsConflictResolution(false);
      toast.success('Loaded from cloud.');
    } catch (error) {
      console.error(error);
      toast.error('Download failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const buttonLabel = useMemo(() => {
    if (!isConfigured) return 'ACCOUNT (DISABLED)';
    if (!session) return 'ACCOUNT';
    return session.user.email ? `ACCOUNT: ${session.user.email}` : 'ACCOUNT';
  }, [isConfigured, session]);

  if (isGitHubPages) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-12 border-2 border-border uppercase tracking-tight"
        onClick={() => setOpen(true)}
        disabled={!isConfigured}
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
              <div className="text-xs font-mono uppercase">
                Signed in as {session.user.email ?? session.user.id}
              </div>
              {needsConflictResolution && (
                <div className="rounded-md border-2 border-border p-3 text-xs font-mono uppercase">
                  Cloud data exists. Choose which version to keep.
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={pullFromCloud}
                  variant="outline"
                  className="border-2 border-border"
                  disabled={isBusy}
                >
                  <CloudDownload className="mr-2 h-4 w-4" />
                  Pull from cloud
                </Button>
                <Button
                  onClick={pushToCloud}
                  variant="outline"
                  className="border-2 border-border"
                  disabled={isBusy}
                >
                  <CloudUpload className="mr-2 h-4 w-4" />
                  Push to cloud
                </Button>
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  className="border-2 border-border"
                  disabled={isBusy}
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
                />
                <Input
                  type="password"
                  placeholder="PASSWORD"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border-2 border-border uppercase tracking-tight"
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
