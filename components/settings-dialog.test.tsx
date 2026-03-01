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
    folders: [{ id: 'f1', name: 'A', albums: [], subfolders: [], isExpanded: true, parentId: null }],
    streamingProvider: s.streamingProvider,
  });

  return { state: s, actions: a, useFolderStoreMock: hook };
});

vi.mock('zustand/react/shallow', () => ({
  useShallow: (fn: any) => fn,
}));

vi.mock('@/lib/store', () => ({
  useFolderStore: useFolderStoreMock,
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

    fireEvent.click(screen.getByRole('button', { name: /Share Shelf Link/i }));
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

    fireEvent.click(screen.getByRole('button', { name: /Share Shelf Link/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
    });
  });
});
