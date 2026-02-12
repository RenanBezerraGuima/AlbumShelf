import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlbumCanvas } from '@/components/album-canvas';
import { useFolderStore } from '@/lib/store';

// Mock the store for testing
vi.mock('@/lib/store', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useFolderStore: Object.assign(
      (selector: any) => selector(useFolderStore.getState()),
      {
        getState: vi.fn(() => ({
          setAlbumPosition: vi.fn(),
        })),
        setState: vi.fn(),
        subscribe: vi.fn(),
      }
    ),
  };
});

describe('AlbumCanvas dragging', () => {
  it('updates the store only once after dragging an album', () => {
    const folderId = 'folder-1';
    const album = {
      id: 'album-1',
      name: 'Album',
      artist: 'Artist',
      imageUrl: 'https://example.com/image.jpg',
      totalTracks: 10,
      position: { x: 10, y: 10 },
    };

    const setAlbumPositionSpy = vi.fn();

    // Setup the mock store state and actions
    vi.mocked(useFolderStore.getState).mockReturnValue({
      setAlbumPosition: setAlbumPositionSpy,
    } as any);

    render(<AlbumCanvas albums={[album]} folderId={folderId} />);

    const albumCard = screen.getByText('Album').closest('[data-album-card]');
    expect(albumCard).toBeInTheDocument();

    // Start drag
    fireEvent.pointerDown(albumCard!, { clientX: 100, clientY: 100 });

    // Move
    fireEvent.pointerMove(window, { clientX: 150, clientY: 150 });
    fireEvent.pointerMove(window, { clientX: 200, clientY: 200 });

    // Store should not have been called yet because we are deferring the update
    expect(setAlbumPositionSpy).not.toHaveBeenCalled();

    // End drag
    fireEvent.pointerUp(window, { clientX: 200, clientY: 200 });

    // Store should be called now, exactly once
    expect(setAlbumPositionSpy).toHaveBeenCalledTimes(1);
    // Initial position was (10, 10). Movement was (200-100, 200-100) = (100, 100).
    // Final position should be (110, 110).
    expect(setAlbumPositionSpy).toHaveBeenCalledWith(folderId, album.id, 110, 110);
  });
});
