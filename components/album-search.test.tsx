import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlbumSearch } from '@/components/album-search';

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
});
