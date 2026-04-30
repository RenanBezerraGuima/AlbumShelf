'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { FolderTree } from '@/components/folder-tree';
import { AlbumGrid } from '@/components/album-grid';
import { AlbumSearch } from '@/components/album-search';
import { MobileHeader } from '@/components/mobile-header';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetHeader,
} from '@/components/ui/sheet';
import {
  useFolderStore,
  applySyncState,
  resetSyncState,
  selectSyncState,
} from '@/lib/store';
import { decompressData } from '@/lib/share-service';
import { hydrateAlbums } from '@/lib/hydration-service';
import { AuthGate } from '@/components/auth-gate';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import { createSeedState, loadUserLibrary, saveUserLibrary } from '@/lib/user-library';

const FirstTimeSetup = dynamic(
  () => import('@/components/first-time-setup').then((mod) => mod.FirstTimeSetup),
);
const SettingsDialog = dynamic(
  () => import('@/components/settings-dialog').then((mod) => mod.SettingsDialog),
);
const SpotifyCallbackHandler = dynamic(
  () =>
    import('@/components/spotify-callback-handler').then(
      (mod) => mod.SpotifyCallbackHandler,
    ),
);
const ShareBanner = dynamic(
  () => import('@/components/share-banner').then((mod) => mod.ShareBanner),
);
const AudioController = dynamic(
  () => import('@/components/audio-controller').then((mod) => mod.AudioController),
);

export default function Home() {
  const isMobile = useIsMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [libraryReady, setLibraryReady] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const syncState = useFolderStore(useShallow(selectSyncState));
  const lastSyncedPayloadRef = useRef<string | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const sessionUserId = session?.user.id ?? null;
  const isSupabaseReady = isSupabaseConfigured();

  useEffect(() => {
    const handleOpenMenu = () => setIsMenuOpen(true);
    window.addEventListener('albumshelf:open-menu', handleOpenMenu);
    return () => window.removeEventListener('albumshelf:open-menu', handleOpenMenu);
  }, []);

  useEffect(() => {
    if (!isSupabaseReady) {
      setAuthReady(true);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error(error);
        toast.error('Failed to restore session');
      }
      setSession(data.session ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);

      if (!nextSession) {
        setLibraryReady(false);
        lastSyncedPayloadRef.current = null;
        resetSyncState();
      }
    });

    return () => subscription.unsubscribe();
  }, [isSupabaseReady]);

  useEffect(() => {
    if (!sessionUserId) return;

    let cancelled = false;

    const bootstrapLibrary = async () => {
      setLibraryReady(false);
      try {
        const remoteState = await loadUserLibrary(sessionUserId);
        if (cancelled) return;

        if (remoteState) {
          applySyncState(remoteState);
          lastSyncedPayloadRef.current = JSON.stringify(remoteState);
        } else {
          const seedState = createSeedState(selectSyncState(useFolderStore.getState()));
          await saveUserLibrary(sessionUserId, seedState);
          if (cancelled) return;
          applySyncState(seedState);
          lastSyncedPayloadRef.current = JSON.stringify(seedState);
        }
      } catch (error) {
        console.error(error);
        toast.error('Failed to load your library', {
          description: 'Check your Supabase table and row-level security setup.',
        });
      } finally {
        if (!cancelled) {
          setLibraryReady(true);
        }
      }
    };

    bootstrapLibrary();

    return () => {
      cancelled = true;
    };
  }, [sessionUserId]);

  useEffect(() => {
    if (!sessionUserId || !libraryReady) return;

    const serializedState = JSON.stringify(syncState);
    if (serializedState === lastSyncedPayloadRef.current) return;

    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = window.setTimeout(async () => {
      try {
        await saveUserLibrary(sessionUserId, syncState);
        lastSyncedPayloadRef.current = serializedState;
      } catch (error) {
        console.error(error);
        toast.error('Failed to sync changes');
      }
    }, 500);

    return () => {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [syncState, sessionUserId, libraryReady]);

  useEffect(() => {
    if (!libraryReady) return;

    // Check for share data in URL (legacy query param or new hash)
    const urlParams = new URLSearchParams(window.location.search);
    const queryShareData = urlParams.get('share');
    const hash = window.location.hash;
    const hashShareData = hash.startsWith('#/share/') ? hash.replace('#/share/', '') : null;

    const shareData = hashShareData || queryShareData;

    if (shareData) {
      const data = decompressData(shareData);
      if (data) {
        const { folders, provider } = data;
        const store = useFolderStore.getState();

        store.setSharedFolders(folders);
        store.setIsGuestMode(true);

        // Select the first folder if none selected
        if (folders.length > 0) {
          store.setSelectedFolder(folders[0].id);
        }

        // Cleanup URL (both legacy and new formats)
        const url = new URL(window.location.href);
        url.searchParams.delete('share');
        url.hash = '';
        window.history.replaceState({}, '', url.toString());

        // Hydration logic
        if (provider) {
          const { spotifyToken, setHydrationProgress, hydrateSharedFolders } = store;

          // Collect all IDs that need hydration
          const idsToHydrate = new Set<string>();
          const collectIds = (nodes: any[]) => {
            nodes.forEach(n => {
              n.albums?.forEach((a: any) => {
                if (a._needsHydration) idsToHydrate.add(a.id);
              });
              if (n.subfolders) collectIds(n.subfolders);
            });
          };
          collectIds(folders);

          if (idsToHydrate.size > 0) {
            setHydrationProgress({ current: 0, total: idsToHydrate.size });

            hydrateAlbums(
              Array.from(idsToHydrate),
              provider,
              spotifyToken,
              (current, total) => setHydrationProgress({ current, total })
            ).then(albumMap => {
              hydrateSharedFolders(albumMap);
              setHydrationProgress(null);
            });
          }
        }
      }
    }
  }, [libraryReady]);

  const handleSignOut = async () => {
    if (!isSupabaseReady || isSigningOut) return;

    setIsSigningOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Signed out');
    } catch (error) {
      console.error(error);
      toast.error('Failed to sign out');
    } finally {
      setIsSigningOut(false);
    }
  };

  const missingConfig = useMemo(
    () => !isSupabaseReady,
    [isSupabaseReady],
  );

  if (missingConfig) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center bg-background px-6 py-10">
        <div className="max-w-xl border-4 border-border brutalist-shadow bg-card p-6 space-y-3">
          <h1 className="text-2xl font-semibold tracking-tighter">Supabase Required</h1>
          <p className="text-sm text-muted-foreground">
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in Vercel and local development
            before using the new authenticated storage flow.
          </p>
        </div>
      </main>
    );
  }

  if (!authReady) {
    return <main className="min-h-[100dvh] bg-background" />;
  }

  if (!session) {
    return <AuthGate />;
  }

  if (!libraryReady) {
    return <main className="min-h-[100dvh] bg-background" />;
  }

  return (
    <main className="h-[100dvh] flex flex-col bg-background relative overflow-hidden">
      <FirstTimeSetup />
      <SettingsDialog
        userEmail={session.user.email}
        accessToken={session.access_token}
        onSignOut={isSigningOut ? undefined : handleSignOut}
      />
      <SpotifyCallbackHandler />
      <ShareBanner />

      {isMobile ? (
        <MobileHeader onMenuClick={() => setIsMenuOpen(true)} />
      ) : (
        <AlbumSearch isMobile={isMobile} onMenuClick={() => setIsMenuOpen(true)} />
      )}

      <div className="flex-1 min-h-0 z-10 relative flex flex-col">
        {isMobile ? (
          <>
            <div className="flex-1 min-h-0 overflow-hidden pb-[68px]">
              <AlbumGrid isMobile={true} />
            </div>

            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetContent side="left" showCloseButton={false} className="p-0 w-[280px] border-r-2 border-border rounded-none shadow-none z-[100]">
                <SheetHeader className="sr-only">
                  <SheetTitle>Collections Menu</SheetTitle>
                  <SheetDescription>Browse your music collections</SheetDescription>
                </SheetHeader>
                <div className="h-full flex flex-col overflow-hidden" onClick={(e) => {
                  // Only close if we clicked a folder item (not a button or input)
                  const target = e.target as HTMLElement;
                  if (target.closest('.cursor-pointer') && !target.closest('button') && !target.closest('input')) {
                    setIsMenuOpen(false);
                  }
                }}>
                  <div className="h-full [&>div]:border-r-0">
                    <FolderTree />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <div className="pb-[68px]">
              <AlbumSearch isMobile={true} />
            </div>
          </>
        ) : (
          <ResizablePanelGroup direction="horizontal" className="h-full pb-[68px]">
            <ResizablePanel defaultSize={20} minSize={15} maxSize={35} className="flex flex-col">
              <FolderTree />
            </ResizablePanel>

            <ResizableHandle withHandle className="w-2 bg-border hover:bg-primary transition-colors" />

            <ResizablePanel defaultSize={80} minSize={50} className="flex flex-col">
              <AlbumGrid />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      <AudioController />
    </main>
  );
}
