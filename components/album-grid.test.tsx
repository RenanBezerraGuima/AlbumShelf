import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlbumGrid } from '@/components/album-grid';
import { useFolderStore } from '@/lib/store';

describe('AlbumGrid spatial mode toggle', () => {
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

  it('Given a selected folder, when canvas mode is enabled, then the infinite canvas container is rendered', () => {
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

    expect(screen.getByTestId('album-canvas')).toBeInTheDocument();
    const folder = useFolderStore.getState().folders.find(f => f.id === folderId);
    expect(folder?.viewMode).toBe('canvas');
  });

  it('Given canvas mode is already persisted for a folder, when the grid renders, then the infinite canvas is shown by default', () => {
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

    expect(screen.getByTestId('album-canvas')).toBeInTheDocument();
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
});
