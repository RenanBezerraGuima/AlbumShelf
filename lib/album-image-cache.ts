import { sanitizeImageUrl } from './security';

const DEFAULT_PRELOAD_CONCURRENCY = 6;
const preloadedAlbumImageUrls = new Set<string>();
const pendingAlbumImagePreloads = new Map<string, Promise<void>>();

function resolveBasePath(pathname?: string) {
  if (process.env.NEXT_PUBLIC_BASE_PATH !== undefined) {
    return process.env.NEXT_PUBLIC_BASE_PATH;
  }

  const currentPathname =
    pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');

  return currentPathname.startsWith('/AlbumShelf') ? '/AlbumShelf' : '';
}

function normalizeBasePath(pathname?: string) {
  const basePath = resolveBasePath(pathname);
  return basePath === '/' ? '' : basePath;
}

function isRemoteAlbumImageUrl(url: string) {
  const sanitizedUrl = sanitizeImageUrl(url);
  return Boolean(sanitizedUrl && sanitizedUrl.startsWith('https://'));
}

function preloadSingleAlbumImage(url: string): Promise<void> {
  const pending = pendingAlbumImagePreloads.get(url);
  if (pending) {
    return pending;
  }

  if (preloadedAlbumImageUrls.has(url)) {
    return Promise.resolve();
  }

  const request = new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = 'async';

    const finish = () => {
      preloadedAlbumImageUrls.add(url);
      pendingAlbumImagePreloads.delete(url);
      resolve();
    };

    image.onload = finish;
    image.onerror = () => {
      pendingAlbumImagePreloads.delete(url);
      resolve();
    };
    image.src = url;
  });

  pendingAlbumImagePreloads.set(url, request);
  return request;
}

async function runWithConcurrencyLimit<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  const runners = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      await worker(items[currentIndex]);
    }
  });

  await Promise.all(runners);
}

export async function registerAlbumImageServiceWorker(
  serviceWorker: ServiceWorkerContainer | undefined = typeof navigator !== 'undefined'
    ? navigator.serviceWorker
    : undefined,
  pathname?: string,
) {
  if (!serviceWorker) {
    return null;
  }

  const basePath = normalizeBasePath(pathname);
  const serviceWorkerUrl = `${basePath}/sw.js`;
  const scope = basePath ? `${basePath}/` : '/';

  try {
    return await serviceWorker.register(serviceWorkerUrl, { scope });
  } catch (error) {
    console.warn('Failed to register album image service worker', error);
    return null;
  }
}

export async function preloadAlbumImages(
  urls: string[],
  concurrency = DEFAULT_PRELOAD_CONCURRENCY,
  onProgress?: (current: number, total: number) => void,
) {
  const uniqueUrls = Array.from(
    new Set(urls.filter((url) => typeof url === 'string' && isRemoteAlbumImageUrl(url))),
  );
  let completed = 0;

  onProgress?.(completed, uniqueUrls.length);

  if (uniqueUrls.length === 0) {
    return;
  }

  await runWithConcurrencyLimit(
    uniqueUrls,
    concurrency,
    async (url) => {
      await preloadSingleAlbumImage(url);
      completed += 1;
      onProgress?.(completed, uniqueUrls.length);
    },
  );
}

export function resetAlbumImageCacheForTests() {
  preloadedAlbumImageUrls.clear();
  pendingAlbumImagePreloads.clear();
}
