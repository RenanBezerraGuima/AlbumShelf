import type { Album } from './types';
import { sanitizeAlbum, MAX_TEXT_LENGTH, jsonp } from './security';

// Simple in-memory cache for search results
const searchCache = new Map<string, { data: Album[], timestamp: number }>();
// Performance: Track in-flight requests to avoid redundant simultaneous network calls for the same query.
const pendingRequests = new Map<string, Promise<Album[]>>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50;

/**
 * Wraps a search function with a simple in-memory cache and request deduplication.
 * Improves performance for repeated searches and reduces network requests during
 * rapid interactions or provider switching.
 */
function withCache<T extends any[]>(
  provider: string,
  fn: (query: string, ...args: T) => Promise<Album[]>
) {
  return async (query: string, ...args: T): Promise<Album[]> => {
    // Defense-in-depth: truncate query BEFORE expensive trim/lower operations to prevent DoS
    const trimmedQuery = String(query || '').slice(0, MAX_TEXT_LENGTH).trim().toLowerCase();
    if (!trimmedQuery) return [];

    // Note: token is intentionally omitted from the cache key as search results
    // for the same query are expected to be identical across valid tokens.
    const cacheKey = `${provider}:${trimmedQuery}`;

    // 1. Check if we have a valid completed cache entry
    const cached = searchCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // 2. Check if there is already a request in flight for this exact provider and query
    const pending = pendingRequests.get(cacheKey);
    if (pending) {
      return pending;
    }

    // 3. Start a new request and track its promise
    const requestPromise = (async () => {
      try {
        const data = await fn(trimmedQuery, ...args);

        // Update the completed cache
        if (searchCache.size >= MAX_CACHE_SIZE) {
          const oldestKey = searchCache.keys().next().value;
          if (oldestKey !== undefined) {
            searchCache.delete(oldestKey);
          }
        }

        searchCache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      } finally {
        // Always remove from pending regardless of success or failure
        pendingRequests.delete(cacheKey);
      }
    })();

    pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
  };
}

async function searchAlbumsDeezerInternal(query: string): Promise<Album[]> {
  try {
    const data = await jsonp<any>(
      `https://api.deezer.com/search/album?q=${encodeURIComponent(query)}&limit=20&output=jsonp`
    );

    if (data.error) {
      throw new Error(data.error.message || 'Deezer search error');
    }

    return data.data.map((item: any) => sanitizeAlbum({
      id: `deezer-${item.id}`,
      name: item.title,
      artist: item.artist.name,
      imageUrl: item.cover_big || item.cover_xl || item.cover_medium,
      releaseDate: '', // Deezer search API doesn't provide release date at top level
      totalTracks: item.nb_tracks,
      externalUrl: item.link,
    }));
  } catch (error) {
    console.error('Deezer search error:', error);
    throw error;
  }
}

async function searchAlbumsSpotifyInternal(query: string, token: string | null): Promise<Album[]> {
  if (!token) return [];

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Spotify session expired. Please reconnect.');
      }
      throw new Error('Spotify search failed');
    }

    const data = await response.json();

    return data.albums.items.map((item: any) => sanitizeAlbum({
      id: `spotify-${item.id}`,
      spotifyId: item.id,
      name: item.name,
      artist: item.artists.map((a: any) => a.name).join(', '),
      imageUrl: item.images[0]?.url || '/placeholder.svg',
      releaseDate: item.release_date,
      totalTracks: item.total_tracks,
      externalUrl: item.external_urls.spotify,
      spotifyUrl: item.external_urls.spotify,
    }));
  } catch (error) {
    console.error('Spotify search error:', error);
    throw error;
  }
}

async function searchAlbumsAppleInternal(query: string): Promise<Album[]> {
  try {
    const data = await jsonp<any>(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=20`
    );

    if (!data.results) {
      return [];
    }

    return data.results.map((item: any) => sanitizeAlbum({
      id: `apple-${item.collectionId}`,
      name: item.collectionName,
      artist: item.artistName,
      imageUrl: item.artworkUrl100.replace('100x100bb', '600x600bb'), // Get higher res image
      releaseDate: item.releaseDate,
      totalTracks: item.trackCount,
      externalUrl: item.collectionViewUrl,
    }));
  } catch (error) {
    console.error('Apple search error:', error);
    throw error;
  }
}

export const searchAlbumsDeezer = withCache('deezer', searchAlbumsDeezerInternal);
export const searchAlbumsApple = withCache('apple', searchAlbumsAppleInternal);
export const searchAlbumsSpotify = withCache('spotify', searchAlbumsSpotifyInternal);

export async function getAlbumDetailsDeezer(albumId: string): Promise<import('./types').AlbumDetails> {
  const numericId = albumId.replace('deezer-', '');
  try {
    const data = await jsonp<any>(
      `https://api.deezer.com/album/${numericId}?output=jsonp`
    );

    if (data.error) {
      throw new Error(data.error.message || 'Deezer album lookup error');
    }

    const tracks = (data.tracks?.data || []).map((t: any) => ({
      id: String(t.id),
      title: t.title,
      preview: t.preview,
      duration: t.duration,
    }));

    const contributors = (data.contributors || []).map((c: any) => c.name);

    return {
      tracks,
      label: data.label,
      contributors: contributors.length > 0 ? contributors : undefined,
    };
  } catch (error) {
    console.error('Deezer album lookup error:', error);
    throw error;
  }
}
