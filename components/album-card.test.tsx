import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlbumCard } from '@/components/album-card';
import type { Album } from '@/lib/types';
import { useFolderStore } from '@/lib/store';
import * as searchService from '@/lib/search-service';

vi.mock('@/lib/search-service', () => ({
  getAlbumDetailsDeezer: vi.fn().mockResolvedValue({ tracks: [], label: '', contributors: [] }),
}));

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
    expect(screen.getAllByText('Test Album')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Test Artist')[0]).toBeInTheDocument();
  });

  it('calls window.open when play button is clicked', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<AlbumCard album={mockAlbum} folderId="folder-1" />);

    const playButton = screen.getByLabelText('Play album');
    fireEvent.click(playButton);

    expect(openSpy).toHaveBeenCalledWith(mockAlbum.externalUrl, '_blank', 'noopener,noreferrer');
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

  it('uses provider search URL when externalUrl is missing', () => {
    useFolderStore.setState({ streamingProvider: 'apple' });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const noUrlAlbum = { ...mockAlbum, externalUrl: undefined };
    render(<AlbumCard album={noUrlAlbum} folderId="folder-1" />);

    fireEvent.click(screen.getByLabelText('Play album'));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('music.apple.com/search?term='),
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('copies artist and title to clipboard on artist click', () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn() },
    });
    render(<AlbumCard album={mockAlbum} folderId="folder-1" />);

    fireEvent.click(screen.getAllByText('Test Artist')[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'Test Artist - Test Album',
    );
  });

  it('removes album after confirming delete dialog', () => {
    const removeSpy = vi.spyOn(useFolderStore.getState(), 'removeAlbumFromFolder');
    render(<AlbumCard album={mockAlbum} folderId="folder-1" />);

    fireEvent.click(screen.getByLabelText('Remove album'));
    fireEvent.click(screen.getByRole('button', { name: /Remove$/i }));

    expect(removeSpy).toHaveBeenCalledWith('folder-1', 'test-album');
  });

  it('flips when Enter or Space is pressed', async () => {
    render(<AlbumCard album={mockAlbum} folderId="folder-1" />);
    const card = screen.getByLabelText(/Test Album by Test Artist/i);

    // Initial state: not flipped
    expect(card).toHaveAttribute('aria-expanded', 'false');

    // Press Enter
    fireEvent.keyDown(card, { key: 'Enter' });
    // Use findBy to wait for async state update
    expect(await screen.findByLabelText(/Test Album by Test Artist - showing tracklist/i)).toBeInTheDocument();

    // Press Space to flip back
    const flippedCard = screen.getByLabelText(/Test Album by Test Artist - showing tracklist/i);
    fireEvent.keyDown(flippedCard, { key: ' ' });
    expect(await screen.findByLabelText(/Test Album by Test Artist - click to flip/i)).toBeInTheDocument();
  });
});
