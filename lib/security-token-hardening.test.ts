import { describe, it, expect, beforeEach } from 'vitest';
import { useFolderStore } from './store';

describe('Security: Spotify Token Hardening', () => {
  beforeEach(() => {
    useFolderStore.setState({
      spotifyToken: null,
      spotifyTokenExpiry: null,
      spotifyTokenTimestamp: null,
    });
  });

  it('should allow sane token metadata', () => {
    const { setSpotifyToken } = useFolderStore.getState();
    const now = Date.now();
    setSpotifyToken('valid-token', 3600, now);

    const state = useFolderStore.getState();
    expect(state.spotifyToken).toBe('valid-token');
    expect(state.spotifyTokenExpiry).toBe(3600);
    expect(state.spotifyTokenTimestamp).toBe(now);
  });

  it('should reject future-dated timestamps (> 5 mins)', () => {
    const { setSpotifyToken } = useFolderStore.getState();
    const future = Date.now() + (10 * 60 * 1000); // 10 minutes in future
    setSpotifyToken('token', 3600, future);

    const state = useFolderStore.getState();
    expect(state.spotifyTokenTimestamp).toBeNull();
  });

  it('should allow slightly future-dated timestamps (< 5 mins) due to clock skew', () => {
    const { setSpotifyToken } = useFolderStore.getState();
    const skew = Date.now() + (2 * 60 * 1000); // 2 minutes in future
    setSpotifyToken('token', 3600, skew);

    const state = useFolderStore.getState();
    expect(state.spotifyTokenTimestamp).toBe(skew);
  });

  it('should reject excessively long expiries (> 1 year)', () => {
    const { setSpotifyToken } = useFolderStore.getState();
    const tooLong = (365 * 24 * 60 * 60) + 1;
    setSpotifyToken('token', tooLong, Date.now());

    const state = useFolderStore.getState();
    expect(state.spotifyTokenExpiry).toBeNull();
  });

  it('should reject non-positive expiries', () => {
    const { setSpotifyToken } = useFolderStore.getState();
    setSpotifyToken('token', 0, Date.now());
    expect(useFolderStore.getState().spotifyTokenExpiry).toBeNull();

    setSpotifyToken('token', -3600, Date.now());
    expect(useFolderStore.getState().spotifyTokenExpiry).toBeNull();
  });

  it('should reject non-finite numbers for metadata', () => {
    const { setSpotifyToken } = useFolderStore.getState();
    setSpotifyToken('token', Infinity, Date.now());
    expect(useFolderStore.getState().spotifyTokenExpiry).toBeNull();

    setSpotifyToken('token', 3600, NaN);
    expect(useFolderStore.getState().spotifyTokenTimestamp).toBeNull();
  });

  it('should truncate and validate the token string itself', () => {
    const { setSpotifyToken } = useFolderStore.getState();
    const longToken = 'A'.repeat(2000);
    setSpotifyToken(longToken, 3600, Date.now());

    expect(useFolderStore.getState().spotifyToken?.length).toBe(1024);

    setSpotifyToken('token\nwith-newline', 3600, Date.now());
    expect(useFolderStore.getState().spotifyToken).toBeNull();
  });
});
