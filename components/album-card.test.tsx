import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlbumCard } from '@/components/album-card';
import type { Album } from '@/lib/types';

describe('AlbumCard', () => {
  const mockAlbum: Album = {
    id: 'test-album',
    name: 'Test Album',
    artist: 'Test Artist',
    imageUrl: 'https://example.com/image.jpg',
    totalTracks: 10,
    externalUrl: 'https://spotify.com/album/test',
  };

  it('renders album info', () => {
    render(<AlbumCard album={mockAlbum} folderId="folder-1" />);
    expect(screen.getByText('Test Album')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
  });

  it('calls window.open when play button is clicked', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<AlbumCard album={mockAlbum} folderId="folder-1" />);

    const playButton = screen.getByLabelText('Play album');
    fireEvent.click(playButton);

    expect(openSpy).toHaveBeenCalledWith(mockAlbum.externalUrl, '_blank');
    openSpy.mockRestore();
  });

  it('stops propagation on play button click', () => {
    const onClick = vi.fn();
    render(
      <div onClick={onClick}>
        <AlbumCard album={mockAlbum} folderId="folder-1" />
      </div>
    );

    const playButton = screen.getByLabelText('Play album');
    fireEvent.click(playButton);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('stops propagation on play button pointer down', () => {
    const onPointerDown = vi.fn();
    render(
      <div onPointerDown={onPointerDown}>
        <AlbumCard album={mockAlbum} folderId="folder-1" />
      </div>
    );

    const playButton = screen.getByLabelText('Play album');
    fireEvent.pointerDown(playButton);

    expect(onPointerDown).not.toHaveBeenCalled();
  });

  it('does not have the grip handle', () => {
    render(<AlbumCard album={mockAlbum} folderId="folder-1" />);
    // The GripVertical icon shouldn't be present.
    // We can check by its aria-label if it had one, but it didn't.
    // However, it was inside a div with "cursor-grab".
    const grabDiv = document.querySelector('.cursor-grab');
    expect(grabDiv).toBeNull();
  });
});
