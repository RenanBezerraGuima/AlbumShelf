import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { registerAlbumImageServiceWorkerMock, preloadAlbumImagesMock } = vi.hoisted(() => ({
  registerAlbumImageServiceWorkerMock: vi.fn().mockResolvedValue(undefined),
  preloadAlbumImagesMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/album-image-cache', () => ({
  registerAlbumImageServiceWorker: (...args: any[]) =>
    registerAlbumImageServiceWorkerMock(...args),
  preloadAlbumImages: (...args: any[]) => preloadAlbumImagesMock(...args),
}));

import { AlbumGrid } from '@/components/album-grid';
import { useFolderStore } from '@/lib/store';

describe('AlbumGrid spatial mode toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preloadAlbumImagesMock.mockResolvedValue(undefined);
  });

  it('shows empty state when no folder is selected', () => {
    useFolderStore.setState({ selectedFolderId: null, folders: [] });
    render(<AlbumGrid />);
    expect(screen.getByText(/No collection selected/i)).toBeInTheDocument();
  });

  it('shows folder not found state for invalid selected folder', () => {
    useFolderStore.setState({ selectedFolderId: 'missing', folders: [] });
    render(<AlbumGrid />);
    expect(screen.getByText(/Error: Collection not found/i)).toBeInTheDocument();
  });

  it('Given a selected folder, when canvas mode is enabled, then the infinite canvas container is rendered', async () => {
    const folderId = 'folder-1';

    useFolderStore.setState({
      selectedFolderId: folderId,
      folders: [
        {
          id: folderId,
          name: 'Favorites',
          parentId: null,
          isExpanded: true,
          subfolders: [],
          viewMode: 'grid',
          albums: [
            {
              id: 'album-1',
              name: 'Album',
              artist: 'Artist',
              imageUrl: 'https://example.com/image.jpg',
              totalTracks: 10,
              position: { x: 0, y: 0 },
            },
          ],
        },
      ],
    });

    render(<AlbumGrid />);

    fireEvent.click(screen.getByRole('button', { name: /Switch to canvas view/i }));

    await waitFor(() => {
      expect(screen.getByTestId('album-canvas')).toBeInTheDocument();
    });
    const folder = useFolderStore.getState().folders.find(f => f.id === folderId);
    expect(folder?.viewMode).toBe('canvas');
  });

  it('Given canvas mode is already persisted for a folder, when the grid renders, then the infinite canvas is shown by default', async () => {
    const folderId = 'folder-1';

    useFolderStore.setState({
      selectedFolderId: folderId,
      folders: [
        {
          id: folderId,
          name: 'Favorites',
          parentId: null,
          isExpanded: true,
          subfolders: [],
          viewMode: 'canvas',
          albums: [
            {
              id: 'album-1',
              name: 'Album',
              artist: 'Artist',
              imageUrl: 'https://example.com/image.jpg',
              totalTracks: 10,
              position: { x: 0, y: 0 },
            },
          ],
        },
      ],
    });

    render(<AlbumGrid />);

    await waitFor(() => {
      expect(screen.getByTestId('album-canvas')).toBeInTheDocument();
    });
  });

  it('Given a selected folder, when "V" key is pressed, then the view mode switches to canvas', () => {
    const folderId = 'folder-1';

    useFolderStore.setState({
      selectedFolderId: folderId,
      folders: [
        {
          id: folderId,
          name: 'Favorites',
          parentId: null,
          isExpanded: true,
          subfolders: [],
          viewMode: 'grid',
          albums: [],
        },
      ],
    });

    render(<AlbumGrid />);

    fireEvent.keyDown(window, { key: 'v' });

    const folder = useFolderStore.getState().folders.find(f => f.id === folderId);
    expect(folder?.viewMode).toBe('canvas');
  });

  it('Given a selected folder in canvas mode, when "G" key is pressed, then the view mode switches to grid', () => {
    const folderId = 'folder-1';

    useFolderStore.setState({
      selectedFolderId: folderId,
      folders: [
        {
          id: folderId,
          name: 'Favorites',
          parentId: null,
          isExpanded: true,
          subfolders: [],
          viewMode: 'canvas',
          albums: [],
        },
      ],
    });

    render(<AlbumGrid />);

    fireEvent.keyDown(window, { key: 'g' });

    const folder = useFolderStore.getState().folders.find(f => f.id === folderId);
    expect(folder?.viewMode).toBe('grid');
  });

  it('dispatches search focus event from empty collection CTA', () => {
    const folderId = 'folder-empty';
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    useFolderStore.setState({
      selectedFolderId: folderId,
      folders: [
        {
          id: folderId,
          name: 'Empty',
          parentId: null,
          isExpanded: true,
          subfolders: [],
          viewMode: 'grid',
          albums: [],
        },
      ],
    });

    render(<AlbumGrid />);
    fireEvent.click(screen.getByRole('button', { name: /Find your first album/i }));
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('virtualizes large album collections in grid mode', async () => {
    const folderId = 'folder-big';
    useFolderStore.setState({
      selectedFolderId: folderId,
      folders: [
        {
          id: folderId,
          name: 'Large Folder',
          parentId: null,
          isExpanded: true,
          subfolders: [],
          viewMode: 'grid',
          albums: Array.from({ length: 120 }, (_, index) => ({
            id: `album-${index}`,
            name: `Album ${index}`,
            artist: 'Artist',
            imageUrl: 'https://example.com/image.jpg',
            totalTracks: 10,
          })),
        },
      ],
    });

    render(<AlbumGrid />);
    await waitFor(() => {
      expect(screen.queryByTestId('album-grid-cover-warmup')).not.toBeInTheDocument();
    });

    const renderedCards = screen.getAllByTestId('album-card-front');
    expect(renderedCards.length).toBeLessThan(120);
    expect(renderedCards.length).toBeGreaterThan(0);
  });

  it('registers persistent album-art caching and preloads the selected collection covers', async () => {
    const folderId = 'folder-cache';
    useFolderStore.setState({
      selectedFolderId: folderId,
      folders: [
        {
          id: folderId,
          name: 'Favorites',
          parentId: null,
          isExpanded: true,
          subfolders: [],
          viewMode: 'grid',
          albums: [
            {
              id: 'album-1',
              name: 'Album 1',
              artist: 'Artist',
              imageUrl: 'https://example.com/cover-1.jpg',
              totalTracks: 10,
            },
            {
              id: 'album-2',
              name: 'Album 2',
              artist: 'Artist',
              imageUrl: 'https://example.com/cover-2.jpg',
              totalTracks: 10,
            },
          ],
        },
      ],
    });

    render(<AlbumGrid />);

    await waitFor(() => {
      expect(registerAlbumImageServiceWorkerMock).toHaveBeenCalledTimes(1);
      expect(preloadAlbumImagesMock).toHaveBeenCalledWith(
        [
          'https://example.com/cover-1.jpg',
          'https://example.com/cover-2.jpg',
        ],
        24,
        expect.any(Function),
      );
    });
  });

  it('shows a blocking cover warm-up state until album art preloading completes', async () => {
    const folderId = 'folder-warmup';
    let resolvePreload: (() => void) | undefined;

    preloadAlbumImagesMock.mockImplementation(
      (_urls: string[], _concurrency: number, onProgress?: (current: number, total: number) => void) =>
        new Promise<void>((resolve) => {
          resolvePreload = resolve;
          onProgress?.(0, 2);
          setTimeout(() => onProgress?.(1, 2), 0);
        }),
    );

    useFolderStore.setState({
      selectedFolderId: folderId,
      folders: [
        {
          id: folderId,
          name: 'Warmup',
          parentId: null,
          isExpanded: true,
          subfolders: [],
          viewMode: 'grid',
          albums: [
            {
              id: 'album-1',
              name: 'Album 1',
              artist: 'Artist',
              imageUrl: 'https://example.com/cover-1.jpg',
              totalTracks: 10,
            },
            {
              id: 'album-2',
              name: 'Album 2',
              artist: 'Artist',
              imageUrl: 'https://example.com/cover-2.jpg',
              totalTracks: 10,
            },
          ],
        },
      ],
    });

    render(<AlbumGrid />);

    expect(screen.getByTestId('album-grid-cover-warmup')).toBeInTheDocument();
    expect(screen.getByText(/Loading covers before opening Warmup/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/1\/2 covers cached locally/i)).toBeInTheDocument();
    });

    if (resolvePreload) {
      resolvePreload();
    }

    await waitFor(() => {
      expect(screen.queryByTestId('album-grid-cover-warmup')).not.toBeInTheDocument();
    });
  });

  it('only marks the first visible covers as eager and high priority', async () => {
    const folderId = 'folder-priority';
    useFolderStore.setState({
      selectedFolderId: folderId,
      folders: [
        {
          id: folderId,
          name: 'Favorites',
          parentId: null,
          isExpanded: true,
          subfolders: [],
          viewMode: 'grid',
          albums: Array.from({ length: 24 }, (_, index) => ({
            id: `album-${index + 1}`,
            name: `Album ${index + 1}`,
            artist: 'Artist',
            imageUrl: `https://example.com/image-${index + 1}.jpg`,
            totalTracks: 10,
          })),
        },
      ],
    });

    render(<AlbumGrid />);
    await waitFor(() => {
      expect(screen.queryByTestId('album-grid-cover-warmup')).not.toBeInTheDocument();
    });

    const albumImages = Array.from(document.querySelectorAll('img')).filter((image) =>
      image.alt.startsWith('Album '),
    );

    const eagerImages = albumImages.filter((image) => image.getAttribute('loading') === 'eager');
    const lazyImages = albumImages.filter((image) => image.getAttribute('loading') === 'lazy');

    expect(eagerImages.length).toBeGreaterThan(0);
    expect(lazyImages.length).toBeGreaterThan(0);
    expect(eagerImages[0]).toHaveAttribute('fetchpriority', 'high');
    expect(lazyImages[0]).toHaveAttribute('fetchpriority', 'auto');
  });
});
