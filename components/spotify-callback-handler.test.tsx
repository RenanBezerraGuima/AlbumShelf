import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const setSpotifyToken = vi.fn();

const { parseSpotifyHashMock, exchangeCodeForTokenMock } = vi.hoisted(() => ({
  parseSpotifyHashMock: vi.fn(),
  exchangeCodeForTokenMock: vi.fn(),
}));

vi.mock('@/lib/store', () => ({
  useFolderStore: (selector: any) => selector({ setSpotifyToken }),
}));

vi.mock('@/lib/spotify-auth', () => ({
  parseSpotifyHash: (hash: string) => parseSpotifyHashMock(hash),
  exchangeCodeForToken: (code: string) => exchangeCodeForTokenMock(code),
}));

import { SpotifyCallbackHandler } from './spotify-callback-handler';

describe('SpotifyCallbackHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', 'http://localhost:3000/AlbumShelf/');
  });

  it('sets spotify token from implicit grant hash when state matches', async () => {
    localStorage.setItem('spotify_auth_state', 'ok');
    window.history.replaceState({}, '', 'http://localhost:3000/AlbumShelf/#access_token=x&state=ok');
    parseSpotifyHashMock.mockReturnValue({
      accessToken: 'tok',
      expiresIn: 3600,
      timestamp: 123,
      state: 'ok',
    });

    render(<SpotifyCallbackHandler />);

    await waitFor(() => {
      expect(setSpotifyToken).toHaveBeenCalledWith('tok', 3600, 123);
    });
  });

  it('exchanges PKCE code and stores token when state matches', async () => {
    localStorage.setItem('spotify_auth_state', 'state1');
    localStorage.setItem('spotify_code_verifier', 'verifier');
    window.history.replaceState({}, '', 'http://localhost:3000/AlbumShelf/?code=abc&state=state1');
    exchangeCodeForTokenMock.mockResolvedValue({
      access_token: 'pkce-token',
      expires_in: 1800,
    });

    render(<SpotifyCallbackHandler />);

    await waitFor(() => {
      expect(exchangeCodeForTokenMock).toHaveBeenCalledWith('abc');
      expect(setSpotifyToken).toHaveBeenCalledWith('pkce-token', 1800, expect.any(Number));
      expect(localStorage.getItem('spotify_code_verifier')).toBeNull();
    });
  });
});
