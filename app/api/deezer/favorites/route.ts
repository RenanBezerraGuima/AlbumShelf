import { NextResponse } from 'next/server';
import {
  getAuthenticatedSupabaseUser,
  getEncryptedConnectionArl,
  DeezerConnectionAuthError,
} from '@/lib/deezer/connection-store';
import { decryptArl, DeezerArlCryptoError } from '@/lib/deezer/arl-crypto';
import { verifyDeezerArl, DeezerArlValidationError } from '@/lib/deezer/web-client';
import { getAllFavoriteAlbums } from '@/lib/deezer/favorites';

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

  console.error('Deezer favorites import route error:', error);
  return jsonError('Unable to import favorite albums from Deezer.', 500);
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabaseUser(request);
    const encryptedArl = await getEncryptedConnectionArl(supabase, user.id);
    if (!encryptedArl) {
      return jsonError('Connect Deezer before importing favorites.', 400);
    }

    const arl = decryptArl(encryptedArl);
    const session = await verifyDeezerArl(arl);

    const albums = await getAllFavoriteAlbums(arl, session.apiToken, session.deezerUserId);

    return NextResponse.json({ albums });
  } catch (error) {
    return toRouteError(error);
  }
}
