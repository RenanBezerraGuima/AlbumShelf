import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  signUpWithPassword,
  fetchUserLibrary,
  upsertUserLibrary,
  isSupabaseConfigured
} from './supabase-client';

describe('Supabase Client Integration', () => {
  const mockUrl = 'https://xyz.supabase.co';
  const mockKey = 'anon-key';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // Mock process.env
    vi.stubGlobal('process', {
      ...process,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: mockUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: mockKey,
      }
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('isSupabaseConfigured returns true when env vars are set', () => {
    expect(isSupabaseConfigured()).toBe(true);
  });

  it('buildUrl normalizes trailing slashes in SUPABASE_URL', async () => {
    vi.stubGlobal('process', {
      ...process,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: mockUrl + '/', // Add trailing slash
        NEXT_PUBLIC_SUPABASE_ANON_KEY: mockKey,
      }
    });

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ session: null }),
    } as Response);

    await signUpWithPassword('test@example.com', 'password123');
    const [url] = fetchMock.mock.calls[0];

    // Should NOT have double slash after .co
    expect(url as string).not.toContain('.co//');
    expect(url as string).toContain('.co/auth/v1/signup');
  });

  it('signUpWithPassword sends correct redirect URL and body', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ session: null }),
    } as Response);

    // Mock window.location
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      origin: 'https://album-shelf.vercel.app',
      pathname: '/',
    } as any;

    await signUpWithPassword('test@example.com', 'password123');

    const [url, options] = fetchMock.mock.calls[0];
    const urlObj = new URL(url as string);

    expect(urlObj.origin).toBe(mockUrl);
    expect(urlObj.pathname).toBe('/auth/v1/signup');
    expect(urlObj.searchParams.get('redirect_to')).toBe('https://album-shelf.vercel.app/');

    const body = JSON.parse(options?.body as string);
    expect(body.email).toBe('test@example.com');
    expect(body.email_redirect_to).toBe('https://album-shelf.vercel.app/');
    expect(body.options.email_redirect_to).toBe('https://album-shelf.vercel.app/');

    window.location = originalLocation;
  });

  it('upsertUserLibrary sends correct on_conflict and Prefer headers', async () => {
    // Mock session
    const session = {
      accessToken: 'token-123',
      refreshToken: 'ref-123',
      expiresAt: Date.now() + 3600000,
      user: { id: 'user-123' }
    };
    localStorage.setItem('albumshelf_supabase_session', JSON.stringify(session));

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      text: () => Promise.resolve(''),
    } as Response);

    await upsertUserLibrary('user-123', { albums: [] });

    const [url, options] = fetchMock.mock.calls[0];
    const urlObj = new URL(url as string);

    expect(urlObj.pathname).toBe('/rest/v1/albumshelf_items');
    expect(urlObj.searchParams.get('on_conflict')).toBe('user_id');

    expect(options?.headers).toMatchObject({
      'apikey': mockKey,
      'Authorization': 'Bearer token-123',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
      'x-client-info': 'album-shelf-web'
    });
  });

  it('fetchUserLibrary sends correct filter and headers', async () => {
    // Mock session
    const session = {
      accessToken: 'token-123',
      refreshToken: 'ref-123',
      expiresAt: Date.now() + 3600000,
      user: { id: 'user-123' }
    };
    localStorage.setItem('albumshelf_supabase_session', JSON.stringify(session));

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ data: { albums: [] }, updated_at: null }]),
    } as Response);

    await fetchUserLibrary('user-123');

    const [url, options] = fetchMock.mock.calls[0];
    const urlObj = new URL(url as string);

    expect(urlObj.searchParams.get('user_id')).toBe('eq.user-123');
    expect(urlObj.searchParams.get('select')).toBe('data,updated_at');

    expect(options?.headers).toMatchObject({
      'Authorization': 'Bearer token-123',
    });
  });

  it('handles request failures gracefully', async () => {
    const session = {
      accessToken: 'token-123',
      refreshToken: 'ref-123',
      expiresAt: Date.now() + 3600000,
      user: { id: 'user-123' }
    };
    localStorage.setItem('albumshelf_supabase_session', JSON.stringify(session));

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Permission denied'),
    } as Response);

    await expect(fetchUserLibrary('user-123')).rejects.toThrow('Permission denied');
  });
});
