import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  getAuthenticatedSupabaseUser: vi.fn(),
  getEncryptedConnectionArl: vi.fn(),
  decryptArl: vi.fn(),
  verifyDeezerArl: vi.fn(),
  getAllFavoriteAlbums: vi.fn(),
}));

vi.mock('@/lib/deezer/connection-store', () => ({
  DeezerConnectionAuthError: class DeezerConnectionAuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DeezerConnectionAuthError';
    }
  },
  getAuthenticatedSupabaseUser: mocks.getAuthenticatedSupabaseUser,
  getEncryptedConnectionArl: mocks.getEncryptedConnectionArl,
}));

vi.mock('@/lib/deezer/arl-crypto', () => ({
  decryptArl: mocks.decryptArl,
  DeezerArlCryptoError: class DeezerArlCryptoError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DeezerArlCryptoError';
    }
  },
}));

vi.mock('@/lib/deezer/web-client', () => ({
  verifyDeezerArl: mocks.verifyDeezerArl,
  DeezerArlValidationError: class DeezerArlValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DeezerArlValidationError';
    }
  },
}));

vi.mock('@/lib/deezer/favorites', () => ({
  getAllFavoriteAlbums: mocks.getAllFavoriteAlbums,
}));

describe('Deezer favorites API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns favorite albums on success', async () => {
    mocks.getAuthenticatedSupabaseUser.mockResolvedValue({
      supabase: {} as any,
      user: { id: 'user-123' } as any,
    });
    mocks.getEncryptedConnectionArl.mockResolvedValue('encrypted-arl');
    mocks.decryptArl.mockReturnValue('decrypted-arl');
    mocks.verifyDeezerArl.mockResolvedValue({
      apiToken: 'token',
      deezerUserId: '123',
    } as any);
    mocks.getAllFavoriteAlbums.mockResolvedValue([
      { id: 'deezer-1', name: 'Album 1', artist: 'Artist 1', imageUrl: 'url1', totalTracks: 10 },
    ]);

    const response = await POST(new Request('http://localhost/api/deezer/favorites', { method: 'POST' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.albums).toHaveLength(1);
    expect(data.albums[0].name).toBe('Album 1');
  });

  it('returns 400 if Deezer is not connected', async () => {
    mocks.getAuthenticatedSupabaseUser.mockResolvedValue({
      supabase: {} as any,
      user: { id: 'user-123' } as any,
    });
    mocks.getEncryptedConnectionArl.mockResolvedValue(null);

    const response = await POST(new Request('http://localhost/api/deezer/favorites', { method: 'POST' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Connect Deezer before importing favorites.');
  });

  it('returns 401 on auth error', async () => {
    const { DeezerConnectionAuthError } = await import('@/lib/deezer/connection-store');
    mocks.getAuthenticatedSupabaseUser.mockImplementation(async () => {
      throw new DeezerConnectionAuthError('Unauthorized');
    });

    const response = await POST(new Request('http://localhost/api/deezer/favorites', { method: 'POST' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 on ARL validation error', async () => {
    const { DeezerArlValidationError } = await import('@/lib/deezer/web-client');
    mocks.getAuthenticatedSupabaseUser.mockResolvedValue({
      supabase: {} as any,
      user: { id: 'user-123' } as any,
    });
    mocks.getEncryptedConnectionArl.mockResolvedValue('encrypted-arl');
    mocks.decryptArl.mockReturnValue('decrypted-arl');
    mocks.verifyDeezerArl.mockImplementation(async () => {
      throw new DeezerArlValidationError('Invalid ARL');
    });

    const response = await POST(new Request('http://localhost/api/deezer/favorites', { method: 'POST' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid ARL');
  });

  it('returns 500 on crypto error', async () => {
    const { DeezerArlCryptoError } = await import('@/lib/deezer/arl-crypto');
    mocks.getAuthenticatedSupabaseUser.mockResolvedValue({
      supabase: {} as any,
      user: { id: 'user-123' } as any,
    });
    mocks.getEncryptedConnectionArl.mockResolvedValue('encrypted-arl');
    mocks.decryptArl.mockImplementation(() => {
      throw new DeezerArlCryptoError('Crypto failed');
    });

    const response = await POST(new Request('http://localhost/api/deezer/favorites', { method: 'POST' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Stored Deezer connection could not be decrypted.');
  });

  it('returns 500 on generic error', async () => {
    mocks.getAuthenticatedSupabaseUser.mockRejectedValue(new Error('Generic failure'));

    const response = await POST(new Request('http://localhost/api/deezer/favorites', { method: 'POST' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Unable to import favorite albums from Deezer.');
  });
});
