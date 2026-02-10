import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlbumGrid } from '@/components/album-grid';
import { useFolderStore } from '@/lib/store';

describe('AlbumGrid spatial mode toggle', () => {
  it('Given a selected folder, when canvas mode is enabled, then the infinite canvas container is rendered', () => {
    const folderId = 'folder-1';

    useFolderStore.setState({
      selectedFolderId: folderId,
      albumViewMode: 'grid',
      folders: [
        {
          id: folderId,
          name: 'Favorites',
          parentId: null,
          isExpanded: true,
          subfolders: [],
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

    fireEvent.click(screen.getByRole('button', { name: 'Switch to canvas view' }));

    expect(screen.getByTestId('album-canvas')).toBeInTheDocument();
    expect(useFolderStore.getState().albumViewMode).toBe('canvas');
  });

  it('Given canvas mode is already persisted, when the grid renders, then the infinite canvas is shown by default', () => {
    const folderId = 'folder-1';

    useFolderStore.setState({
      selectedFolderId: folderId,
      albumViewMode: 'canvas',
      folders: [
        {
          id: folderId,
          name: 'Favorites',
          parentId: null,
          isExpanded: true,
          subfolders: [],
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

    expect(screen.getByTestId('album-canvas')).toBeInTheDocument();
  });
});
