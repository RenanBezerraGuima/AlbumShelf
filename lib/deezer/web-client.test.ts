/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import {
  DeezerArlValidationError,
  deezerGatewayRequest,
  deezerPublicApiRequest,
  normalizeArl,
  verifyDeezerArl,
} from './web-client';

describe('Deezer web client', () => {
  it('normalizes ARL input and rejects unsafe cookie values', () => {
    expect(normalizeArl(` ${'a'.repeat(64)} `)).toBe('a'.repeat(64));
    expect(() => normalizeArl('too-short')).toThrow(DeezerArlValidationError);
    expect(() => normalizeArl(`${'a'.repeat(64)};other=value`)).toThrow(DeezerArlValidationError);
    expect(() => normalizeArl(`${'a'.repeat(64)}\n`)).not.toThrow();
  });

  it('rejects non-string ARL', () => {
    expect(() => normalizeArl(123)).toThrow(DeezerArlValidationError);
  });

  it('verifies a Deezer ARL through the web gateway', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: {
            checkForm: 'api-token',
            USER: {
              USER_ID: 123,
              BLOG_NAME: 'AlbumShelf User',
            },
          },
        }),
        { status: 200 },
      ),
    );

    const session = await verifyDeezerArl('a'.repeat(64), fetchMock);

    expect(session).toEqual({
      deezerUserId: '123',
      displayName: 'AlbumShelf User',
      apiToken: 'api-token',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('method=deezer.getUserData'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          cookie: `arl=${'a'.repeat(64)}`,
        }),
      }),
    );
  });

  it('throws on failed gateway request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    await expect(deezerGatewayRequest('a'.repeat(64), 'method', {}, 'token', fetchMock))
      .rejects.toThrow(DeezerArlValidationError);
  });

  it('rejects expired or anonymous Deezer sessions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: { USER: { USER_ID: 0 } } }), { status: 200 }),
    );

    await expect(verifyDeezerArl('a'.repeat(64), fetchMock)).rejects.toThrow(
      DeezerArlValidationError,
    );
  });

  it('throws on missing user id in verifyDeezerArl', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: { USER: {} } }), { status: 200 }),
    );
    await expect(verifyDeezerArl('a'.repeat(64), fetchMock)).rejects.toThrow(
      DeezerArlValidationError,
    );
  });

  it('performs public API requests with correct headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );

    await deezerPublicApiRequest('a'.repeat(64), '/user/123/albums', { limit: '10' }, fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deezer.com/user/123/albums?limit=10',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'User-Agent': expect.stringContaining('Mozilla'),
          'Accept-Language': 'en-US,en;q=0.9',
          cookie: `arl=${'a'.repeat(64)}`,
        }),
      }),
    );
  });
});
