import { deezerGatewayRequest, DeezerArlValidationError } from './web-client';
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

  let payload: any;
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
  } catch (error) {
    console.warn('Deezer user.getAlbums failed, falling back to album.getUserFavorites', error);
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
  }

  const data = payload?.results?.data;
  const total = Number(payload?.results?.total) || 0;

  if (!Array.isArray(data)) {
    return { albums: [], total: 0 };
  }

  const albums = data.map((item: any) =>
    sanitizeAlbum({
      id: `deezer-${item.ALB_ID || item.ID}`,
      name: item.ALB_TITLE || item.TITLE,
      artist: item.ART_NAME || (item.ARTIST && item.ARTIST.ART_NAME),
      imageUrl: item.ALB_PICTURE || (item.ALBUM && item.ALBUM.ALB_PICTURE),
      releaseDate: item.DIGITAL_RELEASE_DATE || item.RELEASE_DATE,
      totalTracks: Number(item.NB_SONG) || 0,
      externalUrl: `https://www.deezer.com/album/${item.ALB_ID || item.ID}`,
    })
  );

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
