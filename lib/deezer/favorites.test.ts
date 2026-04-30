import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFavoriteAlbums, getAllFavoriteAlbums } from './favorites';
import { deezerGatewayRequest } from './web-client';

vi.mock('./web-client', () => ({
  deezerGatewayRequest: vi.fn(),
  DeezerArlValidationError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DeezerArlValidationError';
    }
  },
}));

describe('Deezer favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFavoriteAlbums', () => {
    it('fetches favorite albums and maps them correctly', async () => {
      const mockPayload = {
        results: {
          data: [
            {
              ALB_ID: '123',
              ALB_TITLE: 'Album Title',
              ART_NAME: 'Artist Name',
              ALB_PICTURE: 'https://example.com/cover.jpg',
              DIGITAL_RELEASE_DATE: '2023-01-01',
              NB_SONG: '10',
            },
          ],
          total: 1,
        },
      };

      vi.mocked(deezerGatewayRequest).mockResolvedValue(mockPayload);

      const result = await getFavoriteAlbums('fake-arl', 'fake-token', '12345');

      expect(deezerGatewayRequest).toHaveBeenCalledWith(
        'fake-arl',
        'user.getAlbums',
        { user_id: 12345, start: 0, nb: 100 },
        'fake-token'
      );

      expect(result.albums).toHaveLength(1);
      expect(result.albums[0]).toMatchObject({
        id: 'deezer-123',
        name: 'Album Title',
        artist: 'Artist Name',
        imageUrl: 'https://example.com/cover.jpg',
        releaseDate: '2023-01-01',
        totalTracks: 10,
        externalUrl: 'https://www.deezer.com/album/123',
      });
      expect(result.total).toBe(1);
    });

    it('handles alternative property names in response', async () => {
        const mockPayload = {
          results: {
            data: [
              {
                ID: '456',
                TITLE: 'Another Album',
                ARTIST: { ART_NAME: 'Another Artist' },
                ALBUM: { ALB_PICTURE: 'https://example.com/another.jpg' },
                RELEASE_DATE: '2022-12-12',
                NB_SONG: 12,
              },
            ],
            total: 1,
          },
        };

        vi.mocked(deezerGatewayRequest).mockResolvedValue(mockPayload);

        const result = await getFavoriteAlbums('fake-arl', 'fake-token', 'user-id');

        expect(result.albums[0]).toMatchObject({
          id: 'deezer-456',
          name: 'Another Album',
          artist: 'Another Artist',
          imageUrl: 'https://example.com/another.jpg',
          releaseDate: '2022-12-12',
          totalTracks: 12,
        });
      });

    it('returns empty list if data is not an array', async () => {
      vi.mocked(deezerGatewayRequest).mockResolvedValue({ results: { data: null, total: 0 } });
      const result = await getFavoriteAlbums('fake-arl', 'fake-token', '12345');
      expect(result.albums).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('falls back to album.getUserFavorites if user.getAlbums fails', async () => {
      const mockPayload = {
        results: {
          data: [{ ALB_ID: '123', ALB_TITLE: 'Fallback Album' }],
          total: 1,
        },
      };

      vi.mocked(deezerGatewayRequest)
        .mockRejectedValueOnce(new Error('user.getAlbums failed'))
        .mockResolvedValueOnce(mockPayload);

      const result = await getFavoriteAlbums('fake-arl', 'fake-token', '12345');

      expect(deezerGatewayRequest).toHaveBeenCalledTimes(2);
      expect(deezerGatewayRequest).toHaveBeenNthCalledWith(
        1,
        'fake-arl',
        'user.getAlbums',
        { user_id: 12345, start: 0, nb: 100 },
        'fake-token'
      );
      expect(deezerGatewayRequest).toHaveBeenNthCalledWith(
        2,
        'fake-arl',
        'album.getUserFavorites',
        { user_id: 12345, start: 0, nb: 100 },
        'fake-token'
      );
      expect(result.albums[0].name).toBe('Fallback Album');
    });
  });

  describe('getAllFavoriteAlbums', () => {
    it('paginates and fetches all albums', async () => {
      vi.mocked(deezerGatewayRequest)
        .mockResolvedValueOnce({
          results: {
            data: Array(100).fill({ ALB_ID: '1', ALB_TITLE: 'A' }),
            total: 150,
          },
        })
        .mockResolvedValueOnce({
          results: {
            data: Array(50).fill({ ALB_ID: '2', ALB_TITLE: 'B' }),
            total: 150,
          },
        });

      const albums = await getAllFavoriteAlbums('fake-arl', 'fake-token', '12345');

      expect(deezerGatewayRequest).toHaveBeenCalledTimes(2);
      expect(albums).toHaveLength(150);
      expect(albums[0].name).toBe('A');
      expect(albums[100].name).toBe('B');
    });

    it('stops if results are empty', async () => {
      vi.mocked(deezerGatewayRequest).mockResolvedValue({
        results: {
          data: [],
          total: 100,
        },
      });

      const albums = await getAllFavoriteAlbums('fake-arl', 'fake-token', 'user-id');
      expect(deezerGatewayRequest).toHaveBeenCalledTimes(1);
      expect(albums).toHaveLength(0);
    });

    it('respects safety limit of 10000 albums', async () => {
      vi.mocked(deezerGatewayRequest).mockResolvedValue({
        results: {
          data: Array(100).fill({ ALB_ID: '1', ALB_TITLE: 'A', ART_NAME: 'B' }),
          total: 20000,
        },
      });

      const albums = await getAllFavoriteAlbums('fake-arl', 'fake-token', 'user-id');
      expect(albums.length).toBe(10000);
    });
  });

  describe('assertNoDeezerError', () => {
    it('handles object errors', async () => {
      vi.mocked(deezerGatewayRequest).mockResolvedValue({
        error: { code: 500, message: 'Object error' },
      });

      await expect(getFavoriteAlbums('arl', 'token', '123')).rejects.toThrow(
        /Deezer favorite albums lookup failed: {"code":500,"message":"Object error"}/
      );
    });
  });
});
