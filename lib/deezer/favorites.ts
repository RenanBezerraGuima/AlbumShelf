import {
  deezerGatewayRequest,
  deezerPublicApiRequest,
  DeezerArlValidationError,
} from './web-client';
import { sanitizeAlbum } from '../security';
import type { Album } from '../types';

export interface DeezerFavoriteAlbumsResult {
  albums: Album[];
  total: number;
}

function assertNoDeezerError(payload: any, action: string) {
  const error = payload?.error;
  if (error && (typeof error === 'string' || (Array.isArray(error) && error.length > 0) || (typeof error === 'object' && Object.keys(error).length > 0))) {
    const detail = typeof error === 'string' ? error : JSON.stringify(error);
    throw new DeezerArlValidationError(`Deezer ${action} failed: ${detail}`);
  }
}

export async function getFavoriteAlbums(
  arl: string,
  apiToken: string,
  deezerUserId: string,
  start = 0,
  nb = 100,
): Promise<DeezerFavoriteAlbumsResult> {
  // Use user_id as number if it looks like one, but keep as string if not
  const userIdParam = /^\d+$/.test(deezerUserId) ? parseInt(deezerUserId, 10) : deezerUserId;

  let data: any[] = [];
  let total = 0;
  let payload: any;

  // Try Internal Gateway (user.getAlbums)
  try {
    payload = await deezerGatewayRequest<any>(
      arl,
      'user.getAlbums',
      {
        user_id: userIdParam,
        start,
        nb,
      },
      apiToken,
    );
    assertNoDeezerError(payload, 'user albums lookup');
    data = payload?.results?.data || [];
    total = Number(payload?.results?.total) || 0;
  } catch (error) {
    console.warn('Deezer user.getAlbums failed, falling back to album.getUserFavorites', error);

    // Try Internal Gateway Fallback (album.getUserFavorites)
    try {
      payload = await deezerGatewayRequest<any>(
        arl,
        'album.getUserFavorites',
        {
          user_id: userIdParam,
          start,
          nb,
        },
        apiToken,
      );
      assertNoDeezerError(payload, 'favorite albums lookup');
      data = payload?.results?.data || [];
      total = Number(payload?.results?.total) || 0;
    } catch (error2) {
      console.warn('Deezer album.getUserFavorites failed, falling back to public API', error2);

      // Final Fallback: Public API
      try {
        console.info('Deezer internal gateway failed, falling back to public API');
        payload = await deezerPublicApiRequest<any>(
          arl,
          `/user/${deezerUserId}/albums`,
          {
            index: String(start),
            limit: String(nb),
          }
        );

        if (payload?.error) {
          throw new DeezerArlValidationError(payload.error.message || 'Public API error');
        }

        data = payload?.data || [];
        total = Number(payload?.total) || 0;
      } catch (error3) {
        console.error('Deezer public API fallback failed', error3);
        // If all fallbacks fail and the last one was a validation error, rethrow it
        if (error3 instanceof DeezerArlValidationError) {
          throw error3;
        }
        // Otherwise, if we started with a validation error, throw that
        if (error instanceof DeezerArlValidationError) {
          throw error;
        }
      }
    }
  }

  if (!Array.isArray(data)) {
    return { albums: [], total: 0 };
  }

  const albums = data.map((item: any) => {
    // Gateway fields vs Public API fields
    const id = item.ALB_ID || item.ID || item.id;
    const name = item.ALB_TITLE || item.TITLE || item.title;
    const artist = item.ART_NAME ||
      (item.ARTIST && item.ARTIST.ART_NAME) ||
      (item.artist && item.artist.name) ||
      'Unknown Artist';
    const imageUrl = item.ALB_PICTURE ||
      (item.ALBUM && item.ALBUM.ALB_PICTURE) ||
      item.cover_medium ||
      item.cover_big ||
      item.cover;
    const releaseDate = item.DIGITAL_RELEASE_DATE || item.RELEASE_DATE || item.release_date;
    const totalTracks = Number(item.NB_SONG) || Number(item.nb_tracks) || 0;

    return sanitizeAlbum({
      id: `deezer-${id}`,
      name,
      artist,
      imageUrl,
      releaseDate,
      totalTracks,
      externalUrl: `https://www.deezer.com/album/${id}`,
    });
  });

  return { albums, total };
}

export async function getAllFavoriteAlbums(
  arl: string,
  apiToken: string,
  deezerUserId: string,
): Promise<Album[]> {
  const allAlbums: Album[] = [];
  let start = 0;
  const nb = 100;
  let hasMore = true;

  while (hasMore) {
    const result = await getFavoriteAlbums(arl, apiToken, deezerUserId, start, nb);
    allAlbums.push(...result.albums);

    if (allAlbums.length >= result.total || result.albums.length === 0) {
      hasMore = false;
    } else {
      start += nb;
    }

    // Safety break for extremely large collections
    if (allAlbums.length >= 10000) {
      hasMore = false;
    }
  }

  return allAlbums;
}
