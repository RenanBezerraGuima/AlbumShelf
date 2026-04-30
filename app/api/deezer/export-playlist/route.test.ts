/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exportAlbumsToDeezerPlaylist: vi.fn(),
  getAuthenticatedSupabaseUser: vi.fn(),
  getEncryptedConnectionArl: vi.fn(),
}));

vi.mock('@/lib/deezer/connection-store', () => ({
  DeezerConnectionAuthError: class DeezerConnectionAuthError extends Error {},
  getAuthenticatedSupabaseUser: mocks.getAuthenticatedSupabaseUser,
  getEncryptedConnectionArl: mocks.getEncryptedConnectionArl,
}));

vi.mock('@/lib/deezer/playlist-export', () => ({
  exportAlbumsToDeezerPlaylist: mocks.exportAlbumsToDeezerPlaylist,
}));

vi.mock('@/lib/deezer/arl-crypto', () => ({
  DeezerArlCryptoError: class DeezerArlCryptoError extends Error {},
}));

vi.mock('@/lib/deezer/web-client', () => ({
  DeezerArlValidationError: class DeezerArlValidationError extends Error {},
}));

describe('/api/deezer/export-playlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSupabaseUser.mockResolvedValue({
      supabase: { from: vi.fn() },
      user: { id: 'user-1' },
    });
    mocks.getEncryptedConnectionArl.mockResolvedValue('encrypted');
    mocks.exportAlbumsToDeezerPlaylist.mockResolvedValue({
      playlistId: '999',
      playlistUrl: 'https://www.deezer.com/playlist/999',
      playlistName: 'AlbumShelf - Favorites',
      albumCount: 1,
      deezerAlbumCount: 1,
      trackCount: 2,
      skippedAlbumCount: 0,
    });
  });

  it('exports albums through the stored encrypted ARL', async () => {
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/deezer/export-playlist', {
      method: 'POST',
      body: JSON.stringify({
        playlistName: 'AlbumShelf - Favorites',
        albums: [{ id: 'deezer-10', name: 'Album', artist: 'Artist' }],
      }),
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.exportAlbumsToDeezerPlaylist).toHaveBeenCalledWith({
      encryptedArl: 'encrypted',
      playlistName: 'AlbumShelf - Favorites',
      albums: [{ id: 'deezer-10', name: 'Album', artist: 'Artist' }],
    });
    expect(json.playlistUrl).toBe('https://www.deezer.com/playlist/999');
  });

  it('requires a saved Deezer connection', async () => {
    mocks.getEncryptedConnectionArl.mockResolvedValue(null);

    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/deezer/export-playlist', {
      method: 'POST',
      body: JSON.stringify({ playlistName: 'x', albums: [] }),
    }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Connect Deezer before exporting playlists.');
  });
});
