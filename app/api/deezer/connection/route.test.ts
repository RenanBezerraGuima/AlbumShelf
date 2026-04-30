/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deleteConnection: vi.fn(),
  encryptArl: vi.fn(),
  getAuthenticatedSupabaseUser: vi.fn(),
  getConnectionMetadata: vi.fn(),
  maskArl: vi.fn(),
  normalizeArl: vi.fn(),
  upsertConnection: vi.fn(),
  verifyDeezerArl: vi.fn(),
}));

vi.mock('@/lib/deezer/arl-crypto', () => ({
  encryptArl: mocks.encryptArl,
  maskArl: mocks.maskArl,
}));

vi.mock('@/lib/deezer/connection-store', () => ({
  DeezerConnectionAuthError: class DeezerConnectionAuthError extends Error {},
  deleteConnection: mocks.deleteConnection,
  getAuthenticatedSupabaseUser: mocks.getAuthenticatedSupabaseUser,
  getConnectionMetadata: mocks.getConnectionMetadata,
  upsertConnection: mocks.upsertConnection,
}));

vi.mock('@/lib/deezer/web-client', () => ({
  DeezerArlValidationError: class DeezerArlValidationError extends Error {},
  normalizeArl: mocks.normalizeArl,
  verifyDeezerArl: mocks.verifyDeezerArl,
}));

describe('/api/deezer/connection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSupabaseUser.mockResolvedValue({
      supabase: { from: vi.fn() },
      user: { id: 'user-1' },
    });
    mocks.getConnectionMetadata.mockResolvedValue({
      user_id: 'user-1',
      deezer_user_id: 'dz-1',
      arl_hint: '...abcd',
      status: 'connected',
      last_verified_at: '2026-04-29T10:00:00.000Z',
      updated_at: '2026-04-29T10:00:00.000Z',
    });
    mocks.normalizeArl.mockReturnValue('a'.repeat(64));
    mocks.verifyDeezerArl.mockResolvedValue({ deezerUserId: 'dz-1' });
    mocks.encryptArl.mockReturnValue('v1:encrypted');
    mocks.maskArl.mockReturnValue('...abcd');
  });

  it('returns sanitized connection status without encrypted ARL', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/deezer/connection'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      connected: true,
      status: 'connected',
      arlHint: '...abcd',
      deezerUserId: 'dz-1',
      lastVerifiedAt: '2026-04-29T10:00:00.000Z',
      updatedAt: '2026-04-29T10:00:00.000Z',
    });
    expect(JSON.stringify(json)).not.toContain('encrypted');
  });

  it('verifies, encrypts, and stores ARL on connect', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/deezer/connection', {
        method: 'POST',
        body: JSON.stringify({ arl: ' a '.repeat(64) }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.verifyDeezerArl).toHaveBeenCalledWith('a'.repeat(64));
    expect(mocks.upsertConnection).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        user_id: 'user-1',
        encrypted_arl: 'v1:encrypted',
        arl_hint: '...abcd',
        deezer_user_id: 'dz-1',
        status: 'connected',
      }),
    );
  });

  it('deletes the stored ARL connection on disconnect', async () => {
    const { DELETE } = await import('./route');
    const response = await DELETE(new Request('http://localhost/api/deezer/connection'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.deleteConnection).toHaveBeenCalledWith(expect.anything(), 'user-1');
    expect(json).toEqual({
      connected: false,
      status: 'not_connected',
      arlHint: null,
      deezerUserId: null,
      lastVerifiedAt: null,
      updatedAt: null,
    });
  });
});
