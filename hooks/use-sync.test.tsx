import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useSync } from './use-sync';
import { useFolderStore, selectSyncState, applySyncState } from '@/lib/store';
import * as supabase from '@/lib/supabase-client';
import { toast } from 'sonner';

vi.mock('@/lib/store', () => ({
  useFolderStore: {
    getState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    setState: vi.fn(),
  },
  selectSyncState: vi.fn(),
  applySyncState: vi.fn(),
}));

vi.mock('@/lib/supabase-client', () => ({
  fetchUserLibrary: vi.fn(),
  getSession: vi.fn(),
  isSupabaseConfigured: vi.fn(() => true),
  upsertUserLibrary: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useSync', () => {
  const mockSession = { user: { id: 'user-1' } };

  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.getSession as any).mockResolvedValue(mockSession);
    (supabase.fetchUserLibrary as any).mockResolvedValue([]);
    (useFolderStore.getState as any).mockReturnValue({ lastUpdated: 0 });
    (selectSyncState as any).mockReturnValue({ lastUpdated: 0 });
  });

  it('should pull from cloud on initial load if cloud is newer', async () => {
    const remoteData = { lastUpdated: 100, folders: [{ id: 'f1' }] };
    (supabase.fetchUserLibrary as any).mockResolvedValue([{ data: remoteData }]);
    (selectSyncState as any).mockReturnValue({ lastUpdated: 0 });

    renderHook(() => useSync());

    await waitFor(() => {
      expect(applySyncState).toHaveBeenCalledWith(remoteData);
    });
    expect(toast.success).toHaveBeenCalledWith('LOADED YOUR CLOUD LIBRARY');
  });

  it('should push to cloud on initial load if local is newer', async () => {
    const remoteData = { lastUpdated: 50, folders: [] };
    const localState = { lastUpdated: 100, folders: [{ id: 'f2' }] };
    (supabase.fetchUserLibrary as any).mockResolvedValue([{ data: remoteData }]);
    (useFolderStore.getState as any).mockReturnValue(localState);
    (selectSyncState as any).mockReturnValue(localState);

    renderHook(() => useSync());

    await waitFor(() => {
      expect(supabase.upsertUserLibrary).toHaveBeenCalledWith('user-1', localState);
    });
    expect(toast.success).toHaveBeenCalledWith('SYNCED LOCAL LIBRARY TO CLOUD');
  });

  it('should push to cloud if no cloud data exists but local has data', async () => {
    (supabase.fetchUserLibrary as any).mockResolvedValue([]);
    const localState = { lastUpdated: 100, folders: [{ id: 'f2' }] };
    (useFolderStore.getState as any).mockReturnValue(localState);
    (selectSyncState as any).mockReturnValue(localState);

    renderHook(() => useSync());

    await waitFor(() => {
      expect(supabase.upsertUserLibrary).toHaveBeenCalledWith('user-1', localState);
    });
    expect(toast.success).toHaveBeenCalledWith('UPLOADED LOCAL LIBRARY TO CLOUD');
  });

  it('should auto-push when local state changes', async () => {
    vi.useFakeTimers();
    const localState = { lastUpdated: 100, folders: [] };
    (selectSyncState as any).mockReturnValue(localState);

    let subscribeCallback: (state: any) => void = () => {};
    (useFolderStore.subscribe as any).mockImplementation((cb: any) => {
      subscribeCallback = cb;
      return vi.fn();
    });

    renderHook(() => useSync());

    // Wait for initial sync to finish so auto-push can start
    await act(async () => {
        vi.runAllTimers();
    });

    const newState = { lastUpdated: 200, folders: [{ id: 'new' }] };
    (selectSyncState as any).mockReturnValue(newState);

    await act(async () => {
      subscribeCallback(newState);
    });

    // Debounce is 2000ms
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(supabase.upsertUserLibrary).toHaveBeenCalledWith('user-1', newState);
    vi.useRealTimers();
  });
});
