import { beforeEach, describe, expect, it, vi } from 'vitest';

const { jsonpMock } = vi.hoisted(() => ({ jsonpMock: vi.fn() }));

vi.mock('./security', async () => ({
  sanitizeAlbum: (album: any) => album,
  sanitizeAlbumDetails: (details: any) => details,
  MAX_TEXT_LENGTH: 200,
  jsonp: jsonpMock,
}));

import {
  getAlbumDetailsDeezer,
  searchAlbumsApple,
  searchAlbumsDeezer,
  searchAlbumsSpotify,
} from './search-service';

describe('search-service', () => {
  beforeEach(() => {
    jsonpMock.mockReset();
    vi.restoreAllMocks();
  });

  it('deduplicates in-flight Deezer search requests for the same query', async () => {
    let resolveRequest: (value: any) => void = () => undefined;
    const pending = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    jsonpMock.mockReturnValueOnce(pending);

    const p1 = searchAlbumsDeezer('Massive Attack');
    const p2 = searchAlbumsDeezer('Massive Attack');

    resolveRequest({
      data: [
        {
          id: 1,
          title: 'Mezzanine',
          artist: { name: 'Massive Attack' },
          cover_big: 'https://example.com/cover.jpg',
          nb_tracks: 10,
          link: 'https://deezer.com/album/1',
        },
      ],
    });

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(jsonpMock).toHaveBeenCalledTimes(1);
    expect(r1).toHaveLength(1);
    expect(r2).toEqual(r1);
  });

  it('returns empty results for Spotify search when token is missing', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch' as any);

    const results = await searchAlbumsSpotify('Radiohead', null);

    expect(results).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('normalizes Apple search albums from JSONP response', async () => {
    jsonpMock.mockResolvedValueOnce({
      results: [
        {
          collectionId: 99,
          collectionName: 'In Rainbows',
          artistName: 'Radiohead',
          artworkUrl100: 'https://example.com/100x100bb.jpg',
          releaseDate: '2007-01-01',
          trackCount: 10,
          collectionViewUrl: 'https://music.apple.com/album/99',
        },
      ],
    });

    const results = await searchAlbumsApple('Radiohead apple unique');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'apple-99',
      name: 'In Rainbows',
      artist: 'Radiohead',
    });
  });

  it('throws spotify session error on 401 responses', async () => {
    vi.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as any);

    await expect(searchAlbumsSpotify('anything', 'token')).rejects.toThrow(
      'Spotify session expired. Please reconnect.',
    );
  });

  it('normalizes Deezer album details response', async () => {
    jsonpMock.mockResolvedValueOnce({
      tracks: {
        data: [{ id: 1, title: 'Track A', preview: 'https://example.com/p.mp3', duration: 12 }],
      },
      label: 'My Label',
      contributors: [{ name: 'One' }, { name: 'Two' }],
    });

    const details = await getAlbumDetailsDeezer('deezer-123');

    expect(details.label).toBe('My Label');
    expect(details.tracks).toHaveLength(1);
    expect(details.contributors).toEqual(['One', 'Two']);
  });

  it('returns empty list when Apple results are missing', async () => {
    jsonpMock.mockResolvedValueOnce({});
    const results = await searchAlbumsApple('unknown');
    expect(results).toEqual([]);
  });

  it('throws on Deezer API error payload', async () => {
    jsonpMock.mockResolvedValueOnce({
      error: { message: 'rate limited' },
    });

    await expect(searchAlbumsDeezer('bad')).rejects.toThrow('rate limited');
  });

  it('throws generic spotify error for non-401 responses', async () => {
    vi.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as any);

    await expect(searchAlbumsSpotify('broken', 'token')).rejects.toThrow(
      'Spotify search failed',
    );
  });
});
