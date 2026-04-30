/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  decryptArl: vi.fn(),
  deezerGatewayRequest: vi.fn(),
  verifyDeezerArl: vi.fn(),
}));

vi.mock('./arl-crypto', () => ({
  decryptArl: mocks.decryptArl,
}));

vi.mock('./web-client', () => ({
  DeezerArlValidationError: class DeezerArlValidationError extends Error {},
  deezerGatewayRequest: mocks.deezerGatewayRequest,
  verifyDeezerArl: mocks.verifyDeezerArl,
}));

import { exportAlbumsToDeezerPlaylist } from './playlist-export';

describe('exportAlbumsToDeezerPlaylist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('collects all Deezer album tracks and creates a playlist', async () => {
    mocks.decryptArl.mockReturnValue('arl');
    mocks.verifyDeezerArl.mockResolvedValue({ deezerUserId: 'u1', apiToken: 'token' });
    mocks.deezerGatewayRequest
      .mockResolvedValueOnce({
        error: [],
        results: {
          data: [{ SNG_ID: 11 }, { SNG_ID: '12' }],
        },
      })
      .mockResolvedValueOnce({
        error: [],
        results: {
          PLAYLIST_ID: 999,
        },
      });

    const result = await exportAlbumsToDeezerPlaylist({
      encryptedArl: 'encrypted',
      playlistName: '  Test Playlist  ',
      albums: [
        { id: 'deezer-10', name: 'Album', artist: 'Artist' },
        { id: 'spotify-20', name: 'Other', artist: 'Artist' },
      ],
    });

    expect(mocks.deezerGatewayRequest).toHaveBeenNthCalledWith(
      1,
      'arl',
      'song.getListByAlbum',
      { alb_id: '10', start: 0, nb: 500 },
      'token',
    );
    expect(mocks.deezerGatewayRequest).toHaveBeenNthCalledWith(
      2,
      'arl',
      'playlist.create',
      expect.objectContaining({
        title: 'Test Playlist',
        songs: [['11'], ['12']],
        status: 1,
      }),
      'token',
    );
    expect(result).toMatchObject({
      playlistId: '999',
      playlistUrl: 'https://www.deezer.com/playlist/999',
      trackCount: 2,
      deezerAlbumCount: 1,
      skippedAlbumCount: 1,
    });
  });

  it('rejects collections without Deezer albums', async () => {
    mocks.decryptArl.mockReturnValue('arl');
    mocks.verifyDeezerArl.mockResolvedValue({ deezerUserId: 'u1', apiToken: 'token' });

    await expect(exportAlbumsToDeezerPlaylist({
      encryptedArl: 'encrypted',
      playlistName: 'Empty',
      albums: [{ id: 'spotify-20', name: 'Other', artist: 'Artist' }],
    })).rejects.toThrow('Selected collection has no Deezer albums');
  });

  it('falls back to the public album API when Deezer gateway track lookup fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.decryptArl.mockReturnValue('arl');
    mocks.verifyDeezerArl.mockResolvedValue({ deezerUserId: 'u1', apiToken: 'token' });
    mocks.deezerGatewayRequest
      .mockResolvedValueOnce({
        error: { DATA_ERROR: 'Could not load album tracks' },
      })
      .mockResolvedValueOnce({
        error: [],
        results: {
          PLAYLIST_ID: 1000,
        },
      });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        tracks: {
          data: [{ id: 21 }, { id: '22' }],
        },
      }), { status: 200 }),
    ));

    const result = await exportAlbumsToDeezerPlaylist({
      encryptedArl: 'encrypted',
      playlistName: 'Fallback Playlist',
      albums: [{ id: 'deezer-30', name: 'Album', artist: 'Artist' }],
    });

    expect(fetch).toHaveBeenCalledWith('https://api.deezer.com/album/30', {
      cache: 'no-store',
    });
    expect(mocks.deezerGatewayRequest).toHaveBeenLastCalledWith(
      'arl',
      'playlist.create',
      expect.objectContaining({
        songs: [['21'], ['22']],
      }),
      'token',
    );
    expect(result).toMatchObject({
      playlistId: '1000',
      trackCount: 2,
    });
    warnSpy.mockRestore();
  });

  it('retries playlist creation without initial tracks and then appends tracks', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.decryptArl.mockReturnValue('arl');
    mocks.verifyDeezerArl.mockResolvedValue({ deezerUserId: 'u1', apiToken: 'token' });
    mocks.deezerGatewayRequest
      .mockResolvedValueOnce({
        error: [],
        results: {
          data: [{ SNG_ID: 31 }, { SNG_ID: 32 }],
        },
      })
      .mockResolvedValueOnce({
        error: { DATA_ERROR: 'Could not create playlist with songs' },
      })
      .mockResolvedValueOnce({
        error: [],
        results: {
          PLAYLIST_ID: 2000,
        },
      })
      .mockResolvedValueOnce({
        error: [],
        results: true,
      });

    const result = await exportAlbumsToDeezerPlaylist({
      encryptedArl: 'encrypted',
      playlistName: 'Retry Playlist',
      albums: [{ id: 'deezer-40', name: 'Album', artist: 'Artist' }],
    });

    expect(mocks.deezerGatewayRequest).toHaveBeenNthCalledWith(
      2,
      'arl',
      'playlist.create',
      expect.objectContaining({
        title: 'Retry Playlist',
        songs: [['31'], ['32']],
      }),
      'token',
    );
    expect(mocks.deezerGatewayRequest).toHaveBeenNthCalledWith(
      3,
      'arl',
      'playlist.create',
      expect.objectContaining({
        title: 'Retry Playlist',
        songs: [],
      }),
      'token',
    );
    expect(mocks.deezerGatewayRequest).toHaveBeenNthCalledWith(
      4,
      'arl',
      'playlist.addSongs',
      expect.objectContaining({
        playlist_id: '2000',
        songs: [['31', 0], ['32', 0]],
      }),
      'token',
    );
    expect(result).toMatchObject({
      playlistId: '2000',
      trackCount: 2,
    });
    warnSpy.mockRestore();
  });
});
