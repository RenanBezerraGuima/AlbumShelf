import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveSupabaseRedirectUrl } from './supabase-client';

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
