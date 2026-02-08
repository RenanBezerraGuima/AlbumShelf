import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveSupabaseRedirectUrl,
  handleAuthCallback,
  fetchUserLibrary,
  getSession,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  upsertUserLibrary,
} from './supabase-client';

const setLocation = (path: string) => {
  window.history.pushState({}, '', path);
};

describe('resolveSupabaseRedirectUrl', () => {
  const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalVercelUrl = process.env.VERCEL_URL;

  afterEach(() => {
    if (originalBasePath === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
    }
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
    if (originalVercelUrl === undefined) {
      delete process.env.VERCEL_URL;
    } else {
      process.env.VERCEL_URL = originalVercelUrl;
    }
    vi.restoreAllMocks();
  });

  it('prefers NEXT_PUBLIC_SITE_URL for hosted redirects', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://album-shelf.vercel.app';
    setLocation('/anywhere');

    expect(resolveSupabaseRedirectUrl()).toBe('https://album-shelf.vercel.app/');
  });

  it('falls back to VERCEL_URL when no site url is provided', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_URL = 'album-shelf.vercel.app';
    setLocation('/anywhere');

    expect(resolveSupabaseRedirectUrl()).toBe('https://album-shelf.vercel.app/');
  });

  it('uses NEXT_PUBLIC_BASE_PATH when provided', () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/custom';
    setLocation('/anywhere');

    expect(resolveSupabaseRedirectUrl()).toBe(`${window.location.origin}/custom/`);
  });

  it('falls back to /AlbumShelf when pathname starts with it', () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    setLocation('/AlbumShelf/library');

    expect(resolveSupabaseRedirectUrl()).toBe(`${window.location.origin}/AlbumShelf/`);
  });

  it('defaults to origin when no base path is detected', () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    setLocation('/other');

    expect(resolveSupabaseRedirectUrl()).toBe(`${window.location.origin}/`);
  });
});

describe('handleAuthCallback', () => {
  it('parses hash and saves session', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    // Mock fetch for getUser
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUser),
    }));

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const hash = '#access_token=abc&refresh_token=xyz&expires_in=3600&token_type=bearer&type=signup';
    const session = await handleAuthCallback(hash);

    expect(session).not.toBeNull();
    expect(session?.accessToken).toBe('abc');
    expect(session?.refreshToken).toBe('xyz');
    expect(session?.user).toEqual(mockUser);

    expect(setItemSpy).toHaveBeenCalledWith(
      'albumshelf_supabase_session',
      expect.stringContaining('"accessToken":"abc"')
    );
    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
    expect(dispatchSpy.mock.calls[0][0].type).toBe('supabase-auth-change');
  });

  it('returns null if parameters are missing', async () => {
    const hash = '#access_token=abc';
    const session = await handleAuthCallback(hash);
    expect(session).toBeNull();
  });
});

describe('fetchUserLibrary authorization', () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  afterEach(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }
    if (originalSupabaseKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseKey;
    }
  });

  beforeEach(() => {
    vi.stubGlobal('window', {
      ...window,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws error if userId does not match session user id', async () => {
    const mockSession = {
      accessToken: 'token',
      user: { id: 'correct-user' },
      expiresAt: Date.now() + 100000
    };

    // Mock getSession to return our mock session
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(mockSession));

    // Attempt to fetch library for a different user
    await expect(fetchUserLibrary('wrong-user')).rejects.toThrow('Unauthorized: User ID mismatch');
  });

  it('does not throw error if userId matches session user id', async () => {
    const mockSession = {
      accessToken: 'token',
      user: { id: 'correct-user' },
      expiresAt: Date.now() + 100000
    };

    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(mockSession));

    // Mock fetch for the request
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }));

    await expect(fetchUserLibrary('correct-user')).resolves.not.toThrow();
  });
});

describe('supabase auth flows', () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://album-shelf.vercel.app';
  });

  afterEach(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }
    if (originalSupabaseKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseKey;
    }
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
    vi.restoreAllMocks();
  });

  it('refreshes expired sessions when possible', async () => {
    const stored = {
      accessToken: 'expired-access',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() - 1000,
      user: { id: 'user-1' },
    };
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(stored));
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
          user: { id: 'user-1' },
        }),
    }));

    const session = await getSession();

    expect(session?.accessToken).toBe('new-access');
    expect(setItemSpy).toHaveBeenCalledWith(
      'albumshelf_supabase_session',
      expect.stringContaining('"accessToken":"new-access"')
    );
  });

  it('clears session when refresh fails', async () => {
    const stored = {
      accessToken: 'expired-access',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() - 1000,
      user: { id: 'user-1' },
    };
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(stored));
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    }));

    await expect(getSession()).resolves.toBeNull();
    expect(removeSpy).toHaveBeenCalledWith('albumshelf_supabase_session');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('signs in with password and stores session', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'access-1',
          refresh_token: 'refresh-1',
          expires_in: 3600,
          user: { id: 'user-1', email: 'user@example.com' },
        }),
    }));

    const session = await signInWithPassword('user@example.com', 'password');

    expect(session.accessToken).toBe('access-1');
    expect(setItemSpy).toHaveBeenCalledWith(
      'albumshelf_supabase_session',
      expect.stringContaining('"accessToken":"access-1"')
    );
  });

  it('signs up with password and includes email redirect url', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          session: {
            access_token: 'access-2',
            refresh_token: 'refresh-2',
            expires_in: 3600,
            user: { id: 'user-2' },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const session = await signUpWithPassword('user@example.com', 'password');

    expect(session?.accessToken).toBe('access-2');
    const requestBody = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(requestBody.email_redirect_to).toBe('https://album-shelf.vercel.app/');
  });

  it('signs out and revokes the session token', async () => {
    const stored = {
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresAt: Date.now() + 10000,
      user: { id: 'user-1' },
    };
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(stored));
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await signOut();

    expect(removeSpy).toHaveBeenCalledWith('albumshelf_supabase_session');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/logout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-1',
        }),
      })
    );
  });
});

describe('upsertUserLibrary authorization', () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  afterEach(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }
    if (originalSupabaseKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseKey;
    }
    vi.restoreAllMocks();
  });

  it('rejects upsert when user id does not match session', async () => {
    const stored = {
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresAt: Date.now() + 100000,
      user: { id: 'user-1' },
    };
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(stored));

    await expect(upsertUserLibrary('user-2', { lastUpdated: 1 })).rejects.toThrow(
      'Unauthorized: User ID mismatch'
    );
  });

  it('logs a helpful message when upsert fails due to missing unique constraint', async () => {
    const stored = {
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresAt: Date.now() + 100000,
      user: { id: 'user-1' },
    };
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(stored));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      text: () => Promise.resolve('column "user_id" is not unique'),
    }));

    await expect(upsertUserLibrary('user-1', { lastUpdated: 1 })).rejects.toThrow(
      'column "user_id" is not unique'
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'UPSERT FAIL: The "user_id" column requires a UNIQUE constraint in Supabase.'
    );
  });
});
