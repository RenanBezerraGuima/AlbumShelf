import { NextResponse } from 'next/server';

import { encryptArl, maskArl } from '@/lib/deezer/arl-crypto';
import {
  deleteConnection,
  getAuthenticatedSupabaseUser,
  getConnectionMetadata,
  type DeezerConnectionMetadata,
  DeezerConnectionAuthError,
  upsertConnection,
} from '@/lib/deezer/connection-store';
import { DeezerArlValidationError, normalizeArl, verifyDeezerArl } from '@/lib/deezer/web-client';

export const runtime = 'nodejs';

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function serializeConnection(metadata: DeezerConnectionMetadata | null) {
  return {
    connected: metadata?.status === 'connected',
    status: metadata?.status ?? 'not_connected',
    arlHint: metadata?.arl_hint ?? null,
    deezerUserId: metadata?.deezer_user_id ?? null,
    lastVerifiedAt: metadata?.last_verified_at ?? null,
    updatedAt: metadata?.updated_at ?? null,
  };
}

function toRouteError(error: unknown) {
  if (error instanceof DeezerConnectionAuthError) {
    return jsonError(error.message, 401);
  }

  if (error instanceof DeezerArlValidationError) {
    return jsonError(error.message, 400);
  }

  console.error('Deezer connection route error:', error);
  return jsonError('Unable to process Deezer connection request.', 500);
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabaseUser(request);
    const metadata = await getConnectionMetadata(supabase, user.id);
    return NextResponse.json(serializeConnection(metadata));
  } catch (error) {
    return toRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabaseUser(request);
    const body = await request.json();
    const arl = normalizeArl(body?.arl);
    const session = await verifyDeezerArl(arl);
    const now = new Date().toISOString();

    await upsertConnection(supabase, {
      user_id: user.id,
      encrypted_arl: encryptArl(arl),
      arl_hint: maskArl(arl),
      deezer_user_id: session.deezerUserId,
      status: 'connected',
      last_verified_at: now,
      updated_at: now,
    });

    const metadata = await getConnectionMetadata(supabase, user.id);
    return NextResponse.json(serializeConnection(metadata));
  } catch (error) {
    return toRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabaseUser(request);
    await deleteConnection(supabase, user.id);
    return NextResponse.json(serializeConnection(null));
  } catch (error) {
    return toRouteError(error);
  }
}
