import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { useIsMobileMock } = vi.hoisted(() => ({
  useIsMobileMock: vi.fn(),
}));

const { decompressDataMock, hydrateAlbumsMock } = vi.hoisted(() => ({
  decompressDataMock: vi.fn(),
  hydrateAlbumsMock: vi.fn(),
}));

const { storeState, useFolderStoreMock } = vi.hoisted(() => {
  const internalState = {
    sharedFolders: null as any,
    spotifyToken: 'token',
    setSharedFolders: vi.fn(),
    setIsGuestMode: vi.fn(),
    setSelectedFolder: vi.fn(),
    setHydrationProgress: vi.fn(),
    hydrateSharedFolders: vi.fn(),
  };
  const hook: any = (selector: any) => selector(internalState);
  hook.getState = () => internalState;
  return { storeState: internalState, useFolderStoreMock: hook };
});

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => useIsMobileMock(),
}));

vi.mock('@/lib/store', () => ({
  useFolderStore: useFolderStoreMock,
  selectSyncState: vi.fn((state) => state),
  applySyncState: vi.fn(),
  resetSyncState: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  getSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-id', email: 'test@example.com' },
            access_token: 'token',
          },
        },
        error: null,
      }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  })),
}));

vi.mock('@/lib/share-service', () => ({
  decompressData: (value: string) => decompressDataMock(value),
}));

vi.mock('@/lib/hydration-service', () => ({
  hydrateAlbums: (...args: any[]) => hydrateAlbumsMock(...args),
}));

vi.mock('@/lib/user-library', () => ({
  loadUserLibrary: vi.fn().mockResolvedValue({ folders: [] }),
  saveUserLibrary: vi.fn(),
  createSeedState: vi.fn((state) => state),
}));

vi.mock('@/components/folder-tree', () => ({ FolderTree: () => <div>FolderTree</div> }));
vi.mock('@/components/album-grid', () => ({ AlbumGrid: () => <div>AlbumGrid</div> }));
vi.mock('@/components/album-search', () => ({
  AlbumSearch: ({ onMenuClick, isMobile }: any) => (
    <button onClick={onMenuClick}>{isMobile ? 'Search Mobile' : 'Search Desktop'}</button>
  ),
}));
vi.mock('@/components/first-time-setup', () => ({ FirstTimeSetup: () => <div>FirstTimeSetup</div> }));
vi.mock('@/components/settings-dialog', () => ({ SettingsDialog: () => <div>SettingsDialog</div> }));
vi.mock('@/components/spotify-callback-handler', () => ({
  SpotifyCallbackHandler: () => <div>SpotifyCallbackHandler</div>,
}));
vi.mock('@/components/mobile-header', () => ({
  MobileHeader: ({ onMenuClick }: any) => <button onClick={onMenuClick}>Mobile Header</button>,
}));
vi.mock('@/components/share-banner', () => ({ ShareBanner: () => <div>ShareBanner</div> }));
vi.mock('@/components/audio-controller', () => ({ AudioController: () => <div>AudioController</div> }));

vi.mock('@/components/ui/resizable', () => ({
  ResizableHandle: () => <div>ResizableHandle</div>,
  ResizablePanel: ({ children }: any) => <div>{children}</div>,
  ResizablePanelGroup: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: any) => <div data-testid="sheet" data-open={String(open)}>{children}</div>,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
  SheetDescription: ({ children }: any) => <div>{children}</div>,
}));

import Home from './page';

describe('Home page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.sharedFolders = null;
    window.history.replaceState({}, '', 'http://localhost:3000/AlbumShelf/');
  });

  it('renders desktop layout and does not hydrate without share payload', async () => {
    useIsMobileMock.mockReturnValue(false);

    render(<Home />);

    expect(await screen.findByText('Search Desktop')).toBeInTheDocument();
    expect(decompressDataMock).not.toHaveBeenCalled();
  });

  it('handles mobile menu open and share hydration flow from hash payload', async () => {
    useIsMobileMock.mockReturnValue(true);
    window.history.replaceState({}, '', 'http://localhost:3000/AlbumShelf/#/share/abc');

    decompressDataMock.mockReturnValue({
      folders: [
        {
          id: 'f1',
          albums: [{ id: 'spotify-1', _needsHydration: true }],
          subfolders: [],
        },
      ],
      provider: 'spotify',
    });
    hydrateAlbumsMock.mockResolvedValue(new Map([['spotify-1', { id: 'spotify-1' }]]));

    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(<Home />);

    fireEvent.click(await screen.findByText('Mobile Header'));
    expect(screen.getByTestId('sheet')).toHaveAttribute('data-open', 'true');

    await waitFor(() => {
      expect(storeState.setSharedFolders).toHaveBeenCalled();
      expect(storeState.setIsGuestMode).toHaveBeenCalledWith(true);
      expect(storeState.setSelectedFolder).toHaveBeenCalledWith('f1');
      expect(storeState.setHydrationProgress).toHaveBeenCalledWith({ current: 0, total: 1 });
    });

    await waitFor(() => {
      expect(hydrateAlbumsMock).toHaveBeenCalledWith(
        ['spotify-1'],
        'spotify',
        'token',
        expect.any(Function),
      );
      expect(storeState.hydrateSharedFolders).toHaveBeenCalled();
      expect(storeState.setHydrationProgress).toHaveBeenCalledWith(null);
    });

    expect(replaceStateSpy).toHaveBeenCalled();
  });
});
