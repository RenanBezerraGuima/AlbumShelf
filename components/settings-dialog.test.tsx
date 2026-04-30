import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const {
  redirectToSpotifyAuthMock,
  generateShareUrlMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  redirectToSpotifyAuthMock: vi.fn(),
  generateShareUrlMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

const { state, actions, useFolderStoreMock } = vi.hoisted(() => {
  const s = {
    isSettingsOpen: true,
    streamingProvider: 'spotify',
    theme: 'industrial',
    geistFont: 'mono',
    spotifyToken: null as string | null,
    spotifyTokenExpiry: null as number | null,
    spotifyTokenTimestamp: null as number | null,
    selectedFolderId: 'folder-1',
    folders: [{
      id: 'folder-1',
      name: 'Favorites',
      parentId: null,
      albums: [
        { id: 'deezer-10', name: 'Album A', artist: 'Artist A', imageUrl: 'https://e.test/a.jpg', totalTracks: 2 },
        { id: 'spotify-20', name: 'Album B', artist: 'Artist B', imageUrl: 'https://e.test/b.jpg', totalTracks: 2 },
      ],
      subfolders: [],
      isExpanded: true,
    }],
    sharedFolders: null,
  };

  const a = {
    setSettingsOpen: vi.fn(),
    setTheme: vi.fn(),
    setStreamingProvider: vi.fn(),
    importFolders: vi.fn(),
  };

  const hook: any = (selector: any) => selector({ ...s, ...a });
  hook.getState = () => ({
    ...s,
    ...a,
    folders: s.folders,
    streamingProvider: s.streamingProvider,
  });

  return { state: s, actions: a, useFolderStoreMock: hook };
});

vi.mock('zustand/react/shallow', () => ({
  useShallow: (fn: any) => fn,
}));

vi.mock('@/lib/store', () => ({
  useFolderStore: useFolderStoreMock,
  findFolder: (folders: any[], id: string) => {
    const stack = [...folders];
    while (stack.length > 0) {
      const folder = stack.shift();
      if (folder.id === id) return folder;
      stack.push(...(folder.subfolders ?? []));
    }
    return null;
  },
}));

vi.mock('@/lib/spotify-auth', () => ({
  redirectToSpotifyAuth: () => redirectToSpotifyAuthMock(),
}));

vi.mock('@/lib/share-service', () => ({
  generateShareUrl: (...args: any[]) => generateShareUrlMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: any[]) => toastSuccessMock(...args),
    error: (...args: any[]) => toastErrorMock(...args),
  },
}));

vi.mock('date-fns', () => ({
  format: () => '01-01-2026',
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

import { SettingsDialog } from './settings-dialog';

describe('SettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.isSettingsOpen = true;
    state.streamingProvider = 'spotify';
    state.spotifyToken = null;
    state.spotifyTokenExpiry = null;
    state.spotifyTokenTimestamp = null;
    state.theme = 'industrial';
    state.selectedFolderId = 'folder-1';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          connected: false,
          status: 'not_connected',
          arlHint: null,
          deezerUserId: null,
          lastVerifiedAt: null,
          updatedAt: null,
        }),
        { status: 200 },
      ),
    ));
    generateShareUrlMock.mockReturnValue('https://example.com/share');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('renders settings and updates theme', () => {
    render(<SettingsDialog />);
    expect(screen.getByText('Settings')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mint/i }));
    expect(actions.setTheme).toHaveBeenCalledWith('mint');
  });

  it('copies share link and exports data', async () => {
    render(<SettingsDialog />);

    const shareButton = await screen.findByRole('button', { name: /Share Shelf Link/i });
    await waitFor(() => {
      expect(shareButton).toBeEnabled();
    });

    fireEvent.click(shareButton);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/share');
      expect(toastSuccessMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Export Data/i }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it('shows spotify connect action and handles keyboard shortcut', () => {
    render(<SettingsDialog />);

    fireEvent.click(screen.getByText(/Connect now/i));
    expect(redirectToSpotifyAuthMock).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 's' });
    expect(actions.setSettingsOpen).toHaveBeenCalled();
  });

  it('imports valid JSON data through hidden file input', async () => {
    const originalFileReader = global.FileReader;
    class FileReaderMock {
      onload: ((ev: any) => void) | null = null;
      readAsText() {
        this.onload?.({
          target: { result: JSON.stringify([{ id: 'imp-1', name: 'Imported' }]) },
        });
      }
    }
    // @ts-expect-error test shim
    global.FileReader = FileReaderMock;

    render(<SettingsDialog />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(['{}'], 'backup.json', { type: 'application/json' })] },
    });

    await waitFor(() => {
      expect(actions.importFolders).toHaveBeenCalledWith([{ id: 'imp-1', name: 'Imported' }]);
      expect(toastSuccessMock).toHaveBeenCalled();
    });

    global.FileReader = originalFileReader;
  });

  it('shows error toast when share copy fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('denied')),
      },
    });
    render(<SettingsDialog />);

    const shareButton = await screen.findByRole('button', { name: /Share Shelf Link/i });
    await waitFor(() => {
      expect(shareButton).toBeEnabled();
    });

    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
    });
  });

  it('shows success state and handles error on import', async () => {
    const originalFileReader = global.FileReader;

    // Test success case
    class SuccessFileReaderMock {
      onload: ((ev: any) => void) | null = null;
      readAsText() {
        this.onload?.({ target: { result: JSON.stringify([{ id: 'imp-1', name: 'Imported' }]) } });
      }
    }
    // @ts-expect-error test shim
    global.FileReader = SuccessFileReaderMock;

    render(<SettingsDialog />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(['{}'], 'backup.json', { type: 'application/json' })] },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Data imported!')).toBeInTheDocument();
      expect(screen.getByText('Data Imported!')).toBeInTheDocument();
    });

    // Test failure case (invalid JSON)
    class ErrorFileReaderMock {
      onload: ((ev: any) => void) | null = null;
      readAsText() {
        this.onload?.({ target: { result: 'invalid json' } });
      }
    }
    // @ts-expect-error test shim
    global.FileReader = ErrorFileReaderMock;

    fireEvent.change(input, {
      target: { files: [new File(['{}'], 'error.json', { type: 'application/json' })] },
    });

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to import data');
    });

    global.FileReader = originalFileReader;
  });

  it('loads Deezer connection status with the Supabase token', async () => {
    render(<SettingsDialog accessToken="supabase-token" />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/deezer/connection', {
        headers: {
          authorization: 'Bearer supabase-token',
        },
      });
    });
    expect(await screen.findByText('not connected')).toBeInTheDocument();
  });

  it('connects Deezer with a pasted ARL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({
        connected: false,
        status: 'not_connected',
        arlHint: null,
        deezerUserId: null,
        lastVerifiedAt: null,
        updatedAt: null,
      }), { status: 200 }),
    ).mockResolvedValueOnce(
      new Response(JSON.stringify({
        connected: true,
        status: 'connected',
        arlHint: '...abcd',
        deezerUserId: '123',
        lastVerifiedAt: '2026-04-29T12:00:00.000Z',
        updatedAt: '2026-04-29T12:00:00.000Z',
      }), { status: 200 }),
    );

    render(<SettingsDialog accessToken="supabase-token" />);

    fireEvent.change(screen.getByPlaceholderText('Paste Deezer ARL'), {
      target: { value: 'arl-token' },
    });
    const connectButton = screen.getByRole('button', { name: /^Connect$/i });
    await waitFor(() => expect(connectButton).toBeEnabled());
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenLastCalledWith('/api/deezer/connection', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer supabase-token',
        },
        body: JSON.stringify({ arl: 'arl-token' }),
      });
      expect(toastSuccessMock).toHaveBeenCalledWith('Deezer connected');
    });
    expect(await screen.findByText('connected')).toBeInTheDocument();
    expect(screen.getByText('...abcd')).toBeInTheDocument();
  });

  it('disconnects Deezer from settings', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({
        connected: true,
        status: 'connected',
        arlHint: '...abcd',
        deezerUserId: '123',
        lastVerifiedAt: '2026-04-29T12:00:00.000Z',
        updatedAt: '2026-04-29T12:00:00.000Z',
      }), { status: 200 }),
    ).mockResolvedValueOnce(
      new Response(JSON.stringify({
        connected: false,
        status: 'not_connected',
        arlHint: null,
        deezerUserId: null,
        lastVerifiedAt: null,
        updatedAt: null,
      }), { status: 200 }),
    );

    render(<SettingsDialog accessToken="supabase-token" />);

    const disconnectButton = await screen.findByRole('button', { name: /^Disconnect$/i });
    await waitFor(() => expect(disconnectButton).toBeEnabled());
    fireEvent.click(disconnectButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenLastCalledWith('/api/deezer/connection', {
        method: 'DELETE',
        headers: {
          authorization: 'Bearer supabase-token',
        },
      });
      expect(toastSuccessMock).toHaveBeenCalledWith('Deezer disconnected');
    });
  });

  it('exports the selected collection to a Deezer playlist', async () => {
    vi.stubGlobal('open', vi.fn());
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({
        connected: true,
        status: 'connected',
        arlHint: '...abcd',
        deezerUserId: '123',
        lastVerifiedAt: '2026-04-29T12:00:00.000Z',
        updatedAt: '2026-04-29T12:00:00.000Z',
      }), { status: 200 }),
    ).mockResolvedValueOnce(
      new Response(JSON.stringify({
        playlistId: '999',
        playlistUrl: 'https://www.deezer.com/playlist/999',
        playlistName: 'AlbumShelf - Favorites',
        albumCount: 2,
        deezerAlbumCount: 1,
        trackCount: 2,
        skippedAlbumCount: 1,
      }), { status: 200 }),
    );

    render(<SettingsDialog accessToken="supabase-token" />);

    const exportButton = await screen.findByRole('button', {
      name: /Export Collection to Deezer Playlist/i,
    });
    await waitFor(() => expect(exportButton).toBeEnabled());
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenLastCalledWith('/api/deezer/export-playlist', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer supabase-token',
        },
        body: JSON.stringify({
          playlistName: 'AlbumShelf - Favorites',
          albums: [
            { id: 'deezer-10', name: 'Album A', artist: 'Artist A' },
            { id: 'spotify-20', name: 'Album B', artist: 'Artist B' },
          ],
        }),
      });
      expect(toastSuccessMock).toHaveBeenCalledWith('Deezer playlist created', {
        description: '2 tracks exported from 1 albums.',
      });
      expect(window.open).toHaveBeenCalledWith(
        'https://www.deezer.com/playlist/999',
        '_blank',
        'noopener,noreferrer',
      );
    });
  });
});
