import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlbumSearch } from '@/components/album-search';
import { searchAlbumsDeezer } from '@/lib/search-service';

const mockState = {
  selectedFolderId: null,
  addAlbumToFolder: vi.fn(),
  removeAlbumFromFolder: vi.fn(),
  streamingProvider: 'deezer',
  spotifyToken: null,
  spotifyTokenExpiry: null,
  spotifyTokenTimestamp: null,
  folders: [],
};

vi.mock('@/lib/store', () => ({
  useFolderStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
  findFolder: () => null,
}));

vi.mock('@/hooks/use-debounce', () => ({
  useDebounce: (callback: (value: string) => void) => callback,
}));

vi.mock('@/lib/search-service', () => ({
  searchAlbumsDeezer: vi.fn(),
  searchAlbumsApple: vi.fn(),
  searchAlbumsSpotify: vi.fn(),
}));

describe('AlbumSearch top panel layout', () => {
  it('keeps the search icon inside the search input wrapper', () => {
    render(<AlbumSearch />);

    const wrapper = screen.getByTestId('search-input-wrapper');
    const searchIcon = screen.getByTestId('search-icon');

    expect(wrapper).toContainElement(searchIcon);
  });

  it('renders Plus icon affordance for non-added albums in search results', async () => {
    const mockAlbums = [{
      id: 'deezer-1',
      name: 'Test Album',
      artist: 'Test Artist',
      imageUrl: 'http://example.com/image.jpg',
      totalTracks: 12,
      externalUrl: 'http://example.com/album'
    }];

    vi.mocked(searchAlbumsDeezer).mockResolvedValue(mockAlbums);

    render(<AlbumSearch />);

    const input = screen.getByPlaceholderText(/SEARCH ON DEEZER/i);
    fireEvent.change(input, { target: { value: 'Test' } });

    // Wait for the result to appear
    await waitFor(() => {
      expect(screen.getByText('Test Album')).toBeInTheDocument();
    });

    // Verify the container for the plus icon exists
    const resultItem = screen.getByTitle(/Add "Test Album" to collection/i);
    expect(resultItem).toBeInTheDocument();

    // Check that the Plus icon is rendered (it's a Lucide icon which renders as an svg)
    const plusIcon = resultItem.querySelector('svg.lucide-plus');
    expect(plusIcon).toBeInTheDocument();
    expect(plusIcon).toHaveClass('opacity-0', 'group-hover:opacity-100');
  });
});
