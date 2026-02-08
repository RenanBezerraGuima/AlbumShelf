import { afterEach, describe, expect, it } from 'vitest';
import { formatCloudError, isDebugEnabled } from './cloud-errors';

describe('cloud error formatting', () => {
  const originalDebug = process.env.NEXT_PUBLIC_DEBUG;

  afterEach(() => {
    if (originalDebug === undefined) {
      delete process.env.NEXT_PUBLIC_DEBUG;
    } else {
      process.env.NEXT_PUBLIC_DEBUG = originalDebug;
    }
  });

  it('returns fallback when debug is disabled', () => {
    process.env.NEXT_PUBLIC_DEBUG = 'false';
    const message = formatCloudError('Upload failed.', new Error('network down'));

    expect(isDebugEnabled()).toBe(false);
    expect(message).toBe('Upload failed.');
  });

  it('includes error details when debug is enabled', () => {
    process.env.NEXT_PUBLIC_DEBUG = 'true';
    const message = formatCloudError('Upload failed.', new Error('network down'));

    expect(isDebugEnabled()).toBe(true);
    expect(message).toBe('Upload failed. (network down)');
  });
});
