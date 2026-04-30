/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import { DeezerArlValidationError, normalizeArl, verifyDeezerArl } from './web-client';

describe('Deezer web client', () => {
  it('normalizes ARL input and rejects unsafe cookie values', () => {
    expect(normalizeArl(` ${'a'.repeat(64)} `)).toBe('a'.repeat(64));
    expect(() => normalizeArl('too-short')).toThrow(DeezerArlValidationError);
    expect(() => normalizeArl(`${'a'.repeat(64)};other=value`)).toThrow(DeezerArlValidationError);
    expect(() => normalizeArl(`${'a'.repeat(64)}\n`)).not.toThrow();
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

  it('rejects expired or anonymous Deezer sessions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: { USER: { USER_ID: 0 } } }), { status: 200 }),
    );

    await expect(verifyDeezerArl('a'.repeat(64), fetchMock)).rejects.toThrow(
      DeezerArlValidationError,
    );
  });
});
