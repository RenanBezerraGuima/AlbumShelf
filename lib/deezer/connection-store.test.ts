import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(),
      })),
    })),
    upsert: vi.fn(),
    delete: vi.fn(() => ({
      eq: vi.fn(),
    })),
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mocks),
}));

import {
  getBearerToken,
  getAuthenticatedSupabaseUser,
  getConnectionMetadata,
  getEncryptedConnectionArl,
  upsertConnection,
  deleteConnection,
} from './connection-store';

describe('connection-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  });

  it('getBearerToken extracts token from header', () => {
    const request = new Request('http://localhost', {
      headers: { authorization: 'Bearer my-token' },
    });
    expect(getBearerToken(request)).toBe('my-token');
  });

  it('getBearerToken throws on missing header', () => {
    const request = new Request('http://localhost');
    expect(() => getBearerToken(request)).toThrow('Missing Supabase bearer token.');
  });

  it('getAuthenticatedSupabaseUser returns user on success', async () => {
    mocks.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });

    const request = new Request('http://localhost', {
      headers: { authorization: 'Bearer valid' },
    });
    const result = await getAuthenticatedSupabaseUser(request);
    expect(result.user.id).toBe('user-123');
  });

  it('getAuthenticatedSupabaseUser throws on invalid token', async () => {
    mocks.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('fail') });

    const request = new Request('http://localhost', {
      headers: { authorization: 'Bearer invalid' },
    });
    await expect(getAuthenticatedSupabaseUser(request)).rejects.toThrow('Invalid Supabase bearer token.');
  });

  it('getConnectionMetadata returns data', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { status: 'connected' }, error: null });
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle
        })
      })
    } as any);

    const data = await getConnectionMetadata({ from: mocks.from } as any, 'user-1');
    expect(data).toEqual({ status: 'connected' });
  });

  it('getEncryptedConnectionArl returns arl', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { encrypted_arl: 'secret', status: 'connected' }, error: null });
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle
        })
      })
    } as any);

    const arl = await getEncryptedConnectionArl({ from: mocks.from } as any, 'user-1');
    expect(arl).toBe('secret');
  });

  it('upsertConnection calls upsert', async () => {
    mocks.from.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null })
    } as any);

    await upsertConnection({ from: mocks.from } as any, {} as any);
    expect(mocks.from).toHaveBeenCalledWith('deezer_connections');
  });

  it('deleteConnection calls delete', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: mockEq
      })
    } as any);

    await deleteConnection({ from: mocks.from } as any, 'user-1');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
