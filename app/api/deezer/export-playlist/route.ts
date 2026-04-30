import { NextResponse } from 'next/server';

import {
  DeezerConnectionAuthError,
  getAuthenticatedSupabaseUser,
  getEncryptedConnectionArl,
} from '@/lib/deezer/connection-store';
import { exportAlbumsToDeezerPlaylist } from '@/lib/deezer/playlist-export';
import { DeezerArlCryptoError } from '@/lib/deezer/arl-crypto';
import { DeezerArlValidationError } from '@/lib/deezer/web-client';

export const runtime = 'nodejs';

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function toRouteError(error: unknown) {
  if (error instanceof DeezerConnectionAuthError) {
    return jsonError(error.message, 401);
  }

  if (error instanceof DeezerArlValidationError) {
    return jsonError(error.message, 400);
  }

  if (error instanceof DeezerArlCryptoError) {
    return jsonError('Stored Deezer connection could not be decrypted.', 500);
  }

  console.error('Deezer export route error:', error);
  return jsonError('Unable to export collection to Deezer.', 500);
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabaseUser(request);
    const encryptedArl = await getEncryptedConnectionArl(supabase, user.id);
    if (!encryptedArl) {
      return jsonError('Connect Deezer before exporting playlists.', 400);
    }

    const body = await request.json();
    const result = await exportAlbumsToDeezerPlaylist({
      encryptedArl,
      playlistName: body?.playlistName,
      albums: Array.isArray(body?.albums) ? body.albums : [],
    });

    return NextResponse.json(result);
  } catch (error) {
    return toRouteError(error);
  }
}
