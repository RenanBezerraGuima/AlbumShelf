import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  preloadAlbumImages,
  registerAlbumImageServiceWorker,
  resetAlbumImageCacheForTests,
} from './album-image-cache';

describe('album-image-cache', () => {
  beforeEach(() => {
    resetAlbumImageCacheForTests();
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    vi.restoreAllMocks();
  });

  it('registers the service worker under the current base path', async () => {
    const register = vi.fn().mockResolvedValue({ scope: '/AlbumShelf/' });

    await registerAlbumImageServiceWorker(
      { register } as unknown as ServiceWorkerContainer,
      '/AlbumShelf/collections/favorites',
    );

    expect(register).toHaveBeenCalledWith('/AlbumShelf/sw.js', {
      scope: '/AlbumShelf/',
    });
  });

  it('uses NEXT_PUBLIC_BASE_PATH when registering the service worker', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/custom-base';
    const register = vi.fn().mockResolvedValue({ scope: '/custom-base/' });

    await registerAlbumImageServiceWorker(
      { register } as unknown as ServiceWorkerContainer,
      '/AlbumShelf/ignored',
    );

    expect(register).toHaveBeenCalledWith('/custom-base/sw.js', {
      scope: '/custom-base/',
    });
  });

  it('preloads unique remote album images with bounded concurrency', async () => {
    const requestedUrls: string[] = [];
    const progress: Array<[number, number]> = [];
    let activeLoads = 0;
    let maxActiveLoads = 0;

    class FakeImage {
      decoding = 'auto';
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      set src(value: string) {
        requestedUrls.push(value);
        activeLoads += 1;
        maxActiveLoads = Math.max(maxActiveLoads, activeLoads);

        setTimeout(() => {
          activeLoads -= 1;
          this.onload?.();
        }, 0);
      }
    }

    vi.stubGlobal('Image', FakeImage as unknown as typeof Image);

    await preloadAlbumImages(
      [
        'https://example.com/cover-a.jpg',
        'https://example.com/cover-a.jpg',
        '/placeholder.svg',
        'data:image/png;base64,abc',
        'https://example.com/cover-b.jpg',
        'https://example.com/cover-c.jpg',
      ],
      2,
      (current, total) => progress.push([current, total]),
    );

    expect(requestedUrls).toEqual([
      'https://example.com/cover-a.jpg',
      'https://example.com/cover-b.jpg',
      'https://example.com/cover-c.jpg',
    ]);
    expect(progress[0]).toEqual([0, 3]);
    expect(progress.at(-1)).toEqual([3, 3]);
    expect(maxActiveLoads).toBeLessThanOrEqual(2);

    await preloadAlbumImages(['https://example.com/cover-a.jpg'], 2);
    expect(requestedUrls).toHaveLength(3);
  });
});
