'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useFolderStore, selectSyncState, applySyncState, type SyncState } from '@/lib/store';
import {
  fetchUserLibrary,
  getSession,
  isSupabaseConfigured,
  upsertUserLibrary,
  type SupabaseSession,
} from '@/lib/supabase-client';
import { toast } from 'sonner';

export function useSync() {
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [needsConflictResolution, setNeedsConflictResolution] = useState(false);
  const [remoteSnapshot, setRemoteSnapshot] = useState<SyncState | null>(null);
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRequestedRemote = useRef(false);
  const lastPushedVersion = useRef<number>(0);

  const isConfigured = isSupabaseConfigured;

  // Handle Session
  useEffect(() => {
    if (!isConfigured) return;

    const updateSession = async () => {
      try {
        const s = await getSession();
        setSession(s);
      } catch (error) {
        setSession(null);
      }
    };

    updateSession();

    const handleAuthChange = () => {
      updateSession();
    };

    window.addEventListener('supabase-auth-change', handleAuthChange);
    return () =>
      window.removeEventListener('supabase-auth-change', handleAuthChange);
  }, [isConfigured]);

  const pushToCloud = useCallback(async (stateToPush?: SyncState) => {
    if (!session || !isConfigured) return;
    const state = stateToPush || selectSyncState(useFolderStore.getState());
    setIsSyncing(true);
    try {
      await upsertUserLibrary(session.user.id, state);
      lastPushedVersion.current = state.lastUpdated;
      setNeedsConflictResolution(false);
      return true;
    } catch (error) {
      console.error('Push failed:', error);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [isConfigured, session]);

  const pullFromCloud = useCallback(async (specificState?: SyncState) => {
    if (!session || !isConfigured) return;
    setIsSyncing(true);
    try {
      let state = specificState;
      if (!state) {
        const rows = await fetchUserLibrary(session.user.id);
        state = rows[0]?.data as SyncState | undefined;
      }

      if (state) {
        applySyncState(state);
        lastPushedVersion.current = state.lastUpdated;
        setNeedsConflictResolution(false);
        setRemoteSnapshot(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Pull failed:', error);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [isConfigured, session]);

  const syncWithRemote = useCallback(async (isInitial = false) => {
    if (!session || !isConfigured) return;
    if (!isInitial) setIsSyncing(true);

    try {
      const rows = await fetchUserLibrary(session.user.id);
      const remoteData = rows[0]?.data as SyncState | undefined;
      const localState = selectSyncState(useFolderStore.getState());

      if (remoteData) {
        const remoteVersion = remoteData.lastUpdated || 0;
        const localVersion = localState.lastUpdated || 0;

        if (localVersion === 0 || remoteVersion > localVersion) {
          // Cloud is newer or local is fresh
          await pullFromCloud(remoteData);
          if (isInitial) toast.success('LOADED YOUR CLOUD LIBRARY');
        } else if (localVersion > remoteVersion) {
          // Local is newer
          await pushToCloud(localState);
          if (isInitial) toast.success('SYNCED LOCAL LIBRARY TO CLOUD');
        } else {
          // Already in sync
          lastPushedVersion.current = localVersion;
        }
      } else if (isInitial && localState.lastUpdated > 0) {
        // No cloud data, but local has data
        await pushToCloud(localState);
        toast.success('UPLOADED LOCAL LIBRARY TO CLOUD');
      }
    } catch (error) {
      console.error('Sync error:', error);
      if (isInitial) toast.error('CLOUD SYNC FAILED');
    } finally {
      if (isInitial) setHasLoadedRemote(true);
      setIsSyncing(false);
    }
  }, [isConfigured, pullFromCloud, pushToCloud, session]);

  // Initial load
  useEffect(() => {
    if (session && isConfigured && !hasLoadedRemote && !hasRequestedRemote.current) {
      hasRequestedRemote.current = true;
      syncWithRemote(true);
    }

    if (!session) {
      hasRequestedRemote.current = false;
      setHasLoadedRemote(false);
      lastPushedVersion.current = 0;
    }
  }, [hasLoadedRemote, isConfigured, session, syncWithRemote]);

  // Periodic and Focus sync
  useEffect(() => {
    if (!session || !isConfigured || !hasLoadedRemote) return;

    const handleFocus = () => syncWithRemote();
    window.addEventListener('focus', handleFocus);
    const intervalId = setInterval(() => syncWithRemote(), 1000 * 60 * 5); // 5 minutes

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(intervalId);
    };
  }, [hasLoadedRemote, isConfigured, session, syncWithRemote]);

  // Auto-push
  useEffect(() => {
    if (!session || !isConfigured || !hasLoadedRemote || needsConflictResolution) return;

    const unsubscribe = useFolderStore.subscribe((state) => {
      const localState = selectSyncState(state);

      if (localState.lastUpdated <= lastPushedVersion.current) return;

      if (syncTimer.current) clearTimeout(syncTimer.current);

      syncTimer.current = setTimeout(() => {
        pushToCloud(localState);
      }, 2000);
    });

    return () => {
      unsubscribe();
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [hasLoadedRemote, isConfigured, needsConflictResolution, pushToCloud, session]);

  return {
    session,
    isSyncing,
    needsConflictResolution,
    remoteSnapshot,
    hasLoadedRemote,
    pushToCloud,
    pullFromCloud,
    syncWithRemote,
    setSession, // For manual sign out etc
  };
}
