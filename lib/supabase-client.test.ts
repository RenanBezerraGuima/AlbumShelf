import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveSupabaseRedirectUrl, handleAuthCallback, fetchUserLibrary } from './supabase-client';

const setLocation = (path: string) => {
  window.history.pushState({}, '', path);
};

describe('resolveSupabaseRedirectUrl', () => {
  const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

  afterEach(() => {
    if (originalBasePath === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
    }
    vi.restoreAllMocks();
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
