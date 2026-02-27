import type { Album, StreamingProvider } from './types';
import { sanitizeAlbum, jsonp } from './security';

/**
 * Hydrates metadata for a list of album IDs from a specific provider.
 */
export async function hydrateAlbums(
  ids: string[],
  provider: StreamingProvider,
  spotifyToken: string | null,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, Album>> {
  const results = new Map<string, Album>();
  if (ids.length === 0) return results;

  const total = ids.length;
  let current = 0;

  const updateProgress = (count: number) => {
    current += count;
    onProgress?.(current, total);
  };

  if (provider === 'spotify' && spotifyToken) {
    // Spotify allows batching up to 20 IDs
    const cleanIds = ids.map(id => id.replace('spotify-', ''));
    for (let i = 0; i < cleanIds.length; i += 20) {
      const batch = cleanIds.slice(i, i + 20);
      try {
        const response = await fetch(
          `https://api.spotify.com/v1/albums?ids=${batch.join(',')}`,
          { headers: { Authorization: `Bearer ${spotifyToken}` } }
        );
        if (response.ok) {
          const data = await response.json();
          data.albums.forEach((item: any) => {
            if (!item) return;
            const album = sanitizeAlbum({
              id: `spotify-${item.id}`,
              spotifyId: item.id,
              name: item.name,
              artist: item.artists.map((a: any) => a.name).join(', '),
              imageUrl: item.images[0]?.url || '/placeholder.svg',
              releaseDate: item.release_date,
              totalTracks: item.total_tracks,
              externalUrl: item.external_urls.spotify,
              spotifyUrl: item.external_urls.spotify,
            });
            results.set(album.id, album);
          });
        }
      } catch (e) {
        console.error('Spotify hydration error:', e);
      }
      updateProgress(batch.length);
    }
  } else if (provider === 'apple') {
    // Apple allows lookup up to 200 IDs
    const cleanIds = ids.map(id => id.replace('apple-', ''));
    for (let i = 0; i < cleanIds.length; i += 200) {
      const batch = cleanIds.slice(i, i + 200);
      try {
        // Since we need JSONP for Apple, we use a custom fetch-like wrapper for the lookup
        const data = await jsonpLookupApple(batch.join(','));
        data.results.forEach((item: any) => {
          if (item.wrapperType !== 'collection') return;
          const album = sanitizeAlbum({
            id: `apple-${item.collectionId}`,
            name: item.collectionName,
            artist: item.artistName,
            imageUrl: item.artworkUrl100.replace('100x100bb', '600x600bb'),
            releaseDate: item.releaseDate,
            totalTracks: item.trackCount,
            externalUrl: item.collectionViewUrl,
          });
          results.set(album.id, album);
        });
      } catch (e) {
        console.error('Apple hydration error:', e);
      }
      updateProgress(batch.length);
    }
  } else if (provider === 'deezer') {
    // Deezer requires individual calls. We'll use a limited concurrency.
    const cleanIds = ids.map(id => id.replace('deezer-', ''));
    const CONCURRENCY = 5;
    for (let i = 0; i < cleanIds.length; i += CONCURRENCY) {
      const batch = cleanIds.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (id) => {
        try {
          const data = await jsonpLookupDeezer(id);
          if (data && !data.error) {
            const album = sanitizeAlbum({
              id: `deezer-${data.id}`,
              name: data.title,
              artist: data.artist.name,
              imageUrl: data.cover_big || data.cover_xl,
              releaseDate: data.release_date,
              totalTracks: data.nb_tracks,
              externalUrl: data.link,
            });
            results.set(album.id, album);
          }
        } catch (e) {
          console.error(`Deezer hydration error for ${id}:`, e);
        }
      }));
      updateProgress(batch.length);
    }
  }

  return results;
}

async function jsonpLookupApple(ids: string): Promise<any> {
  return jsonp(`https://itunes.apple.com/lookup?id=${encodeURIComponent(ids)}`);
}

async function jsonpLookupDeezer(id: string): Promise<any> {
  return jsonp(`https://api.deezer.com/album/${encodeURIComponent(id)}&output=jsonp`);
}
