import type { Album } from './types';
import { sanitizeAlbum } from './security';

// Simple in-memory cache for search results
const searchCache = new Map<string, { data: Album[], timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50;

const TRUSTED_JSONP_DOMAINS = ['api.deezer.com', 'itunes.apple.com'];

/**
 * Wraps a search function with a simple in-memory cache.
 * Improves performance for repeated searches and reduces network requests.
 */
function withCache<T extends any[]>(
  provider: string,
  fn: (query: string, ...args: T) => Promise<Album[]>
) {
  return async (query: string, ...args: T): Promise<Album[]> => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) return [];

    // Note: token is intentionally omitted from the cache key as search results
    // for the same query are expected to be identical across valid tokens.
    const cacheKey = `${provider}:${trimmedQuery}`;
    const cached = searchCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const data = await fn(query, ...args);

    // Maintain cache size
    if (searchCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = searchCache.keys().next().value;
      if (oldestKey !== undefined) {
        searchCache.delete(oldestKey);
      }
    }

    searchCache.set(cacheKey, { data, timestamp: now });
    return data;
  };
}

// Helper for JSONP requests to Deezer and Apple APIs
function jsonp<T>(url: string): Promise<T> {
  // Domain whitelist check for defense-in-depth
  try {
    const parsed = new URL(url);
    if (!TRUSTED_JSONP_DOMAINS.includes(parsed.hostname)) {
      throw new Error(`Untrusted JSONP domain: ${parsed.hostname}`);
    }
  } catch (e) {
    return Promise.reject(e instanceof Error ? e : new Error('Invalid JSONP URL'));
  }

  return new Promise((resolve, reject) => {
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    const callbackName = `jsonp_callback_${randomArray[0]}`;
    const script = document.createElement('script');

    // @ts-ignore
    window[callbackName] = (data: T) => {
      delete (window as any)[callbackName];
      document.body.removeChild(script);
      resolve(data);
    };

    script.src = `${url}${url.indexOf('?') >= 0 ? '&' : '?'}callback=${callbackName}`;
    script.onerror = () => {
      delete (window as any)[callbackName];
      document.body.removeChild(script);
      reject(new Error(`JSONP request failed for ${url}`));
    };
    document.body.appendChild(script);
  });
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
