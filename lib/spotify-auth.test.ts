import { beforeEach, describe, expect, it } from 'vitest';
import { getSpotifyAuthUrl, parseSpotifyHash } from './spotify-auth';

describe('spotify-auth', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', 'http://localhost:3000/AlbumShelf/');
    process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID = 'test-client-id';
    delete process.env.NEXT_PUBLIC_BASE_PATH;
  });

  it('parses access token and expiry from hash callback', () => {
    const parsed = parseSpotifyHash(
      '#access_token=abc123&expires_in=7200&state=xyz',
    );

    expect(parsed).toMatchObject({
      accessToken: 'abc123',
      expiresIn: 7200,
      state: 'xyz',
    });
    expect(typeof parsed?.timestamp).toBe('number');
  });

  it('returns null for invalid hash payload', () => {
    expect(parseSpotifyHash('')).toBeNull();
    expect(parseSpotifyHash('#state=only-state')).toBeNull();
  });

  it('builds auth URL with redirect_uri based on detected base path', () => {
    const authUrl = getSpotifyAuthUrl();
    const url = new URL(authUrl);

    expect(url.origin + url.pathname).toBe(
      'https://accounts.spotify.com/authorize',
    );
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/AlbumShelf/',
    );
    expect(sessionStorage.getItem('spotify_auth_state')).toBeTruthy();
  });

  it('uses explicit NEXT_PUBLIC_BASE_PATH override for redirect uri', () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/custom';
    window.history.replaceState({}, '', 'http://localhost:3000/custom/');

    const authUrl = getSpotifyAuthUrl();
    const url = new URL(authUrl);

    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/custom/',
    );
  });
});
