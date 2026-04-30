'use client';

import type { SyncState } from '@/lib/store';
import { defaultSyncState } from '@/lib/store';
import { getSupabaseBrowserClient } from '@/lib/supabase';

const TABLE_NAME = 'user_library_states';

interface UserLibraryRow {
  user_id: string;
  state: SyncState;
  updated_at: string;
}

export async function loadUserLibrary(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('user_id, state, updated_at')
    .eq('user_id', userId)
    .maybeSingle<UserLibraryRow>();

  if (error) throw error;
  return data?.state ?? null;
}

export async function saveUserLibrary(userId: string, state: SyncState) {
  const supabase = getSupabaseBrowserClient();
  const payload: UserLibraryRow = {
    user_id: userId,
    state,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from(TABLE_NAME).upsert(payload);
  if (error) throw error;
}

export function createSeedState(currentState: SyncState): SyncState {
  const hasLocalData =
    currentState.folders.length > 0 ||
    currentState.hasSetPreference ||
    currentState.streamingProvider !== defaultSyncState.streamingProvider;

  if (!hasLocalData) {
    return {
      ...defaultSyncState,
      theme: currentState.theme,
      geistFont: currentState.geistFont,
      lastUpdated: Date.now(),
    };
  }

  return currentState;
}
