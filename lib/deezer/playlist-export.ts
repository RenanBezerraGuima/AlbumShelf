import { decryptArl } from './arl-crypto';
import { deezerGatewayRequest, verifyDeezerArl, DeezerArlValidationError } from './web-client';

const MAX_ALBUMS_PER_EXPORT = 250;
const MAX_TRACKS_PER_EXPORT = 2000;
const TRACK_BATCH_SIZE = 400;

export interface DeezerExportAlbumInput {
  id: string;
  name: string;
  artist: string;
}

export interface DeezerPlaylistExportInput {
  encryptedArl: string;
  playlistName: string;
  albums: DeezerExportAlbumInput[];
}

export interface DeezerPlaylistExportResult {
  playlistId: string;
  playlistUrl: string;
  playlistName: string;
  albumCount: number;
  deezerAlbumCount: number;
  trackCount: number;
  skippedAlbumCount: number;
}

function normalizePlaylistName(name: unknown) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return 'AlbumShelf export';
  return trimmed.slice(0, 120);
}

function getDeezerAlbumId(id: string) {
  const match = /^deezer-(\d+)$/.exec(id);
  return match?.[1] ?? null;
}

function assertNoDeezerError(payload: any, action: string) {
  const error = payload?.error;
  if (error && ((Array.isArray(error) && error.length > 0) || !Array.isArray(error))) {
    throw new DeezerArlValidationError(`Deezer ${action} failed.`);
  }
}

async function getAlbumTrackIds(arl: string, apiToken: string, albumId: string) {
  try {
    const payload = await deezerGatewayRequest<any>(
      arl,
      'song.getListByAlbum',
      {
        alb_id: albumId,
        start: 0,
        nb: 500,
      },
      apiToken,
    );

    assertNoDeezerError(payload, 'album track lookup');

    const tracks: any[] = Array.isArray(payload?.results?.data) ? payload.results.data : [];
    return tracks
      .map((track: any) => track?.SNG_ID)
      .filter((id: unknown): id is string | number => typeof id === 'string' || typeof id === 'number')
      .map(String)
      .filter((id) => /^\d+$/.test(id));
  } catch (error) {
    console.warn(`Deezer gateway album track lookup failed for ${albumId}; falling back to public album API.`, error);
    return getPublicAlbumTrackIds(albumId);
  }
}

async function getPublicAlbumTrackIds(albumId: string, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(`https://api.deezer.com/album/${encodeURIComponent(albumId)}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new DeezerArlValidationError('Deezer album track lookup failed.');
  }

  const payload = await response.json();
  if (payload?.error) {
    throw new DeezerArlValidationError('Deezer album track lookup failed.');
  }

  const tracks: any[] = Array.isArray(payload?.tracks?.data) ? payload.tracks.data : [];
  return tracks
    .map((track: any) => track?.SNG_ID)
    .map((id: unknown, index: number) => id ?? tracks[index]?.id)
    .filter((id: unknown): id is string | number => typeof id === 'string' || typeof id === 'number')
    .map(String)
    .filter((id) => /^\d+$/.test(id));
}

async function createPlaylist(
  arl: string,
  apiToken: string,
  playlistName: string,
  initialTrackIds: string[],
): Promise<{ playlistId: string; initialTracksIncluded: boolean }> {
  const payload = await createPlaylistRequest(arl, apiToken, playlistName, initialTrackIds);
  if (hasDeezerError(payload) && initialTrackIds.length > 0) {
    console.warn('Deezer playlist creation with initial tracks failed; retrying empty playlist creation.');
    const emptyPayload = await createPlaylistRequest(arl, apiToken, playlistName, []);
    assertNoDeezerError(emptyPayload, 'playlist creation');
    return {
      playlistId: extractPlaylistId(emptyPayload),
      initialTracksIncluded: false,
    };
  }

  assertNoDeezerError(payload, 'playlist creation');
  return {
    playlistId: extractPlaylistId(payload),
    initialTracksIncluded: initialTrackIds.length > 0,
  };
}

async function createPlaylistRequest(
  arl: string,
  apiToken: string,
  playlistName: string,
  initialTrackIds: string[],
) {
  return deezerGatewayRequest<any>(
    arl,
    'playlist.create',
    {
      title: playlistName,
      description: `Created from AlbumShelf on ${new Date().toISOString().slice(0, 10)}.`,
      songs: initialTrackIds.map((id) => [id]),
      status: 1,
    },
    apiToken,
  );
}

function hasDeezerError(payload: any) {
  const error = payload?.error;
  return Boolean(error && ((Array.isArray(error) && error.length > 0) || !Array.isArray(error)));
}

function extractPlaylistId(payload: any) {
  const playlistId =
    payload?.results?.PLAYLIST_ID ??
    payload?.results?.playlist_id ??
    payload?.results?.id;

  if (!playlistId) {
    throw new DeezerArlValidationError('Deezer did not return a playlist ID.');
  }

  return String(playlistId);
}

async function addSongsToPlaylist(
  arl: string,
  apiToken: string,
  playlistId: string,
  trackIds: string[],
) {
  if (trackIds.length === 0) return;

  const payload = await deezerGatewayRequest<any>(
    arl,
    'playlist.addSongs',
    {
      playlist_id: playlistId,
      songs: trackIds.map((id) => [id, 0]),
      offset: -1,
      ctxt: {
        id: null,
        t: null,
      },
    },
    apiToken,
  );

  assertNoDeezerError(payload, 'playlist track append');
}

export async function exportAlbumsToDeezerPlaylist({
  encryptedArl,
  playlistName,
  albums,
}: DeezerPlaylistExportInput): Promise<DeezerPlaylistExportResult> {
  const arl = decryptArl(encryptedArl);
  const session = await verifyDeezerArl(arl);
  const safePlaylistName = normalizePlaylistName(playlistName);
  const limitedAlbums = albums.slice(0, MAX_ALBUMS_PER_EXPORT);
  const deezerAlbumIds = limitedAlbums
    .map((album) => getDeezerAlbumId(album.id))
    .filter((id): id is string => Boolean(id));

  if (deezerAlbumIds.length === 0) {
    throw new DeezerArlValidationError('Selected collection has no Deezer albums to export.');
  }

  const trackIds: string[] = [];
  for (const albumId of deezerAlbumIds) {
    const albumTracks = await getAlbumTrackIds(arl, session.apiToken, albumId);
    for (const trackId of albumTracks) {
      if (trackIds.length >= MAX_TRACKS_PER_EXPORT) break;
      trackIds.push(trackId);
    }
    if (trackIds.length >= MAX_TRACKS_PER_EXPORT) break;
  }

  if (trackIds.length === 0) {
    throw new DeezerArlValidationError('No Deezer tracks were found for the selected collection.');
  }

  const [initialTrackIds, ...remainingBatches] = Array.from(
    { length: Math.ceil(trackIds.length / TRACK_BATCH_SIZE) },
    (_, index) => trackIds.slice(index * TRACK_BATCH_SIZE, (index + 1) * TRACK_BATCH_SIZE),
  );

  const { playlistId, initialTracksIncluded } = await createPlaylist(
    arl,
    session.apiToken,
    safePlaylistName,
    initialTrackIds,
  );

  const batchesToAppend = initialTracksIncluded
    ? remainingBatches
    : [initialTrackIds, ...remainingBatches];
  for (const batch of batchesToAppend) {
    await addSongsToPlaylist(arl, session.apiToken, playlistId, batch);
  }

  return {
    playlistId,
    playlistUrl: `https://www.deezer.com/playlist/${playlistId}`,
    playlistName: safePlaylistName,
    albumCount: limitedAlbums.length,
    deezerAlbumCount: deezerAlbumIds.length,
    trackCount: trackIds.length,
    skippedAlbumCount: limitedAlbums.length - deezerAlbumIds.length,
  };
}
