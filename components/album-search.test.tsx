import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlbumSearch } from '@/components/album-search';
import { searchAlbumsDeezer } from '@/lib/search-service';
import { redirectToSpotifyAuth } from '@/lib/spotify-auth';

const { mockState, useFolderStoreMock } = vi.hoisted(() => {
  const s = {
    selectedFolderId: null as string | null,
    addAlbumToFolder: vi.fn(),
    removeAlbumFromFolder: vi.fn(),
    removeAlbumsFromFolder: vi.fn(),
    setStreamingProvider: vi.fn(),
    streamingProvider: 'deezer',
    spotifyToken: null as string | null,
    spotifyTokenExpiry: null as number | null,
    spotifyTokenTimestamp: null as number | null,
    folders: [] as any[],
  };
  const hook: any = (selector: (state: typeof s) => unknown) => selector(s);
  hook.getState = () => s;
  return { mockState: s, useFolderStoreMock: hook };
});
const { findFolderMock } = vi.hoisted(() => ({ findFolderMock: vi.fn() }));

vi.mock('@/lib/store', () => ({
  useFolderStore: useFolderStoreMock,
  findFolder: (...args: any[]) => findFolderMock(...args),
}));

vi.mock('@/hooks/use-debounce', () => ({
  useDebounce: (callback: (value: string) => void) => callback,
}));

vi.mock('@/lib/search-service', () => ({
  searchAlbumsDeezer: vi.fn(),
  searchAlbumsApple: vi.fn(),
  searchAlbumsSpotify: vi.fn(),
}));

vi.mock('@/lib/spotify-auth', () => ({
  redirectToSpotifyAuth: vi.fn(),
}));

describe('AlbumSearch top panel layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.selectedFolderId = null;
    mockState.streamingProvider = 'deezer';
    mockState.spotifyToken = null;
    mockState.spotifyTokenExpiry = null;
    mockState.spotifyTokenTimestamp = null;
    findFolderMock.mockReturnValue(null);
  });

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
      imageUrl: 'https://example.com/image.jpg',
      totalTracks: 12,
      externalUrl: 'https://example.com/album'
    }];

    vi.mocked(searchAlbumsDeezer).mockResolvedValue(mockAlbums);

    render(<AlbumSearch />);

    const input = screen.getByPlaceholderText(/SEARCH.*ON DEEZER/i);
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
    expect(plusIcon).toHaveClass('opacity-40', 'group-hover:opacity-100');
  });

  it('renders pivot buttons when no results are found', async () => {
    vi.mocked(searchAlbumsDeezer).mockResolvedValue([]);

    render(<AlbumSearch />);

    const input = screen.getByPlaceholderText(/SEARCH.*ON DEEZER/i);
    fireEvent.change(input, { target: { value: 'NonExistent' } });

    await waitFor(() => {
      expect(screen.getByText(/No albums found for "NonExistent" on DEEZER/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Try on apple/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try on spotify/i })).toBeInTheDocument();
  });

  it('shows spotify connection error and triggers auth redirect', async () => {
    mockState.streamingProvider = 'spotify';
    mockState.spotifyToken = null;
    mockState.spotifyTokenExpiry = null;
    mockState.spotifyTokenTimestamp = null;

    render(<AlbumSearch />);

    const input = screen.getByPlaceholderText(/SEARCH.*ON SPOTIFY/i);
    fireEvent.change(input, { target: { value: 'Daft Punk' } });

    await waitFor(() => {
      expect(screen.getByText(/Spotify session expired or not connected/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Connect Spotify/i }));
    expect(redirectToSpotifyAuth).toHaveBeenCalled();
    mockState.streamingProvider = 'deezer';
  });

  it('adds album when selected folder is set and album is not present', async () => {
    mockState.selectedFolderId = 'folder-1';
    findFolderMock.mockReturnValue({ albums: [] });
    vi.mocked(searchAlbumsDeezer).mockResolvedValue([
      {
        id: 'deezer-2',
        name: 'New Album',
        artist: 'New Artist',
        imageUrl: 'https://example.com/new.jpg',
        totalTracks: 8,
      } as any,
    ]);

    render(<AlbumSearch />);
    fireEvent.change(screen.getByPlaceholderText(/SEARCH.*ON DEEZER/i), {
      target: { value: 'New' },
    });

    await waitFor(() => {
      expect(screen.getByText('New Album')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle(/Add "New Album" to collection/i));
    expect(mockState.addAlbumToFolder).toHaveBeenCalledWith(
      'folder-1',
      expect.objectContaining({ id: 'deezer-2' }),
    );
  });

  it('removes matching albums when result already exists in folder', async () => {
    mockState.selectedFolderId = 'folder-1';
    findFolderMock.mockReturnValue({
      albums: [{ id: 'existing-1', name: 'Dup', artist: 'Artist' }],
    });
    vi.mocked(searchAlbumsDeezer).mockResolvedValue([
      {
        id: 'deezer-dup',
        name: 'Dup',
        artist: 'Artist',
        imageUrl: 'https://example.com/dup.jpg',
        totalTracks: 10,
      } as any,
    ]);

    render(<AlbumSearch />);
    fireEvent.change(screen.getByPlaceholderText(/SEARCH.*ON DEEZER/i), {
      target: { value: 'Dup' },
    });

    await waitFor(() => {
      expect(screen.getByText('Dup')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle(/Remove "Dup" from collection/i));
    expect(mockState.removeAlbumsFromFolder).toHaveBeenCalledWith(
      'folder-1',
      ['existing-1'],
    );
  });
});
