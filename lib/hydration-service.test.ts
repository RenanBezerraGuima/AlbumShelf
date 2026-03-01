import { describe, expect, it, vi, beforeEach } from 'vitest';

const { jsonpMock } = vi.hoisted(() => ({ jsonpMock: vi.fn() }));

vi.mock('./security', async () => {
  return {
    sanitizeAlbum: (album: any) => album,
    jsonp: jsonpMock,
  };
});

import { hydrateAlbums } from './hydration-service';

describe('hydrateAlbums', () => {
  beforeEach(() => {
    jsonpMock.mockReset();
    vi.restoreAllMocks();
  });

  it('uses a valid Deezer JSONP URL with output query parameter', async () => {
    jsonpMock.mockResolvedValue({
      id: 42,
      title: 'Test Album',
      artist: { name: 'Test Artist' },
      cover_big: 'https://example.com/cover.jpg',
      release_date: '2020-01-01',
      nb_tracks: 9,
      link: 'https://deezer.com/album/42',
    });

    const result = await hydrateAlbums(['deezer-42'], 'deezer', null);

    expect(jsonpMock).toHaveBeenCalledTimes(1);
    expect(jsonpMock).toHaveBeenCalledWith(
      'https://api.deezer.com/album/42?output=jsonp',
    );
    expect(result.get('deezer-42')).toMatchObject({
      id: 'deezer-42',
      name: 'Test Album',
    });
  });

  it('hydrates spotify albums in batch and updates progress', async () => {
    const fetchMock = vi.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        albums: [
          {
            id: 'abc',
            name: 'Spotify Album',
            artists: [{ name: 'Artist' }],
            images: [{ url: 'https://example.com/x.jpg' }],
            release_date: '2021-01-01',
            total_tracks: 8,
            external_urls: { spotify: 'https://open.spotify.com/album/abc' },
          },
        ],
      }),
    } as any);

    const progress: Array<[number, number]> = [];
    const result = await hydrateAlbums(
      ['spotify-abc'],
      'spotify',
      'token',
      (current, total) => progress.push([current, total]),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.get('spotify-abc')?.name).toBe('Spotify Album');
    expect(progress).toEqual([[1, 1]]);
  });

  it('returns empty map when ids are empty', async () => {
    const result = await hydrateAlbums([], 'apple', null);
    expect(result.size).toBe(0);
  });
});
