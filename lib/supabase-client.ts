type SupabaseUser = {
  id: string;
  email?: string;
};

export type SupabaseSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: SupabaseUser;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SESSION_STORAGE_KEY = 'albumshelf_supabase_session';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const buildUrl = (path: string) => `${SUPABASE_URL}${path}`;

const saveSession = (session: SupabaseSession | null) => {
  if (typeof window === 'undefined') return;
  if (!session) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

const readSession = (): SupabaseSession | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SupabaseSession;
  } catch {
    return null;
  }
};

const request = async <T>(
  path: string,
  options: RequestInit & { headers?: Record<string, string> } = {}
) => {
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
};

const toSession = (payload: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: SupabaseUser;
}) => {
  const expiresAt = Date.now() + payload.expires_in * 1000;
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt,
    user: payload.user,
  } satisfies SupabaseSession;
};

export const getSession = async () => {
  if (!isSupabaseConfigured) return null;
  const stored = readSession();
  if (!stored) return null;
  if (stored.expiresAt > Date.now() + 30_000) {
    return stored;
  }

  try {
    const refreshed = await request<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user: SupabaseUser;
    }>(`/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stored.refreshToken}`,
      },
      body: JSON.stringify({ refresh_token: stored.refreshToken }),
    });
    const session = toSession(refreshed);
    saveSession(session);
    return session;
  } catch {
    saveSession(null);
    return null;
  }
};

export const signInWithPassword = async (email: string, password: string) => {
  const payload = await request<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: SupabaseUser;
  }>(`/auth/v1/token?grant_type=password`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const session = toSession(payload);
  saveSession(session);
  return session;
};

export const signUpWithPassword = async (email: string, password: string) => {
  const payload = await request<{
    session?: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user: SupabaseUser;
    };
  }>(`/auth/v1/signup`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (payload.session) {
    const session = toSession(payload.session);
    saveSession(session);
    return session;
  }

  return null;
};

export const signOut = async () => {
  const session = readSession();
  saveSession(null);
  if (!session) return;
  await request(`/auth/v1/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });
};

export const fetchUserLibrary = async (userId: string) => {
  const session = await getSession();
  if (!session) throw new Error('No active session.');
  return request<{ data: unknown; updated_at: string | null }[]>(
    `/rest/v1/albumshelf_items?user_id=eq.${userId}&select=data,updated_at`,
    {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    }
  );
};

export const upsertUserLibrary = async (userId: string, data: unknown) => {
  const session = await getSession();
  if (!session) throw new Error('No active session.');
  return request(
    `/rest/v1/albumshelf_items?on_conflict=user_id`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        data,
        updated_at: new Date().toISOString(),
      }),
    }
  );
};
