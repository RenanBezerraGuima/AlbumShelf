import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export interface DeezerConnectionMetadata {
  user_id: string;
  deezer_user_id: string | null;
  arl_hint: string | null;
  status: 'connected' | 'expired' | 'invalid';
  last_verified_at: string | null;
  updated_at: string | null;
}

interface DeezerConnectionUpsert {
  user_id: string;
  encrypted_arl: string;
  arl_hint: string;
  deezer_user_id: string;
  status: 'connected';
  last_verified_at: string;
  updated_at: string;
}

const TABLE_NAME = 'deezer_connections';

export class DeezerConnectionAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeezerConnectionAuthError';
  }
}

function getSupabaseServerClient(accessToken: string): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const [scheme, token] = authorization.split(/\s+/, 2);

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new DeezerConnectionAuthError('Missing Supabase bearer token.');
  }

  return token;
}

export async function getAuthenticatedSupabaseUser(request: Request) {
  const accessToken = getBearerToken(request);
  const supabase = getSupabaseServerClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new DeezerConnectionAuthError('Invalid Supabase bearer token.');
  }

  return { supabase, user: data.user as User };
}

export async function getConnectionMetadata(
  supabase: SupabaseClient,
  userId: string,
): Promise<DeezerConnectionMetadata | null> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('user_id, deezer_user_id, arl_hint, status, last_verified_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle<DeezerConnectionMetadata>();

  if (error) throw error;
  return data ?? null;
}

export async function getEncryptedConnectionArl(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('encrypted_arl, status')
    .eq('user_id', userId)
    .maybeSingle<{ encrypted_arl: string; status: string }>();

  if (error) throw error;
  if (!data || data.status !== 'connected') return null;
  return data.encrypted_arl;
}

export async function upsertConnection(
  supabase: SupabaseClient,
  connection: DeezerConnectionUpsert,
) {
  const { error } = await supabase.from(TABLE_NAME).upsert(connection);
  if (error) throw error;
}

export async function deleteConnection(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.from(TABLE_NAME).delete().eq('user_id', userId);
  if (error) throw error;
}
