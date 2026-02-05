import type { Album } from './types';

// Helper for JSONP requests to Deezer API
function jsonp<T>(url: string): Promise<T> {
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

export async function searchAlbumsDeezer(query: string): Promise<Album[]> {
  if (!query.trim()) return [];

  try {
    const data = await jsonp<any>(
      `https://api.deezer.com/search/album?q=${encodeURIComponent(query)}&limit=20&output=jsonp`
    );

    if (data.error) {
      throw new Error(data.error.message || 'Deezer search error');
    }

    return data.data.map((item: any) => ({
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

export async function searchAlbumsSpotify(query: string, token: string | null): Promise<Album[]> {
  if (!query.trim() || !token) return [];

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

    return data.albums.items.map((item: any) => ({
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

export async function searchAlbumsApple(query: string): Promise<Album[]> {
  if (!query.trim()) return [];

  try {
    const data = await jsonp<any>(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=20`
    );

    if (!data.results) {
      return [];
    }

    return data.results.map((item: any) => ({
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
