import type { Album, Folder, Theme, AlbumViewMode, StreamingProvider, GeistFont } from './types';
import { THEMES, VIEW_MODES, STREAMING_PROVIDERS, GEIST_FONTS } from './types';

const ALLOWED_PROTOCOLS = ['https:'];
export const MAX_URL_LENGTH = 2048;
export const MAX_TEXT_LENGTH = 200;
export const MAX_ID_LENGTH = 100;
export const MAX_NAME_LENGTH = 100;
export const MAX_DATE_LENGTH = 50;
export const MAX_TOKEN_LENGTH = 1024;

export const TRUSTED_JSONP_DOMAINS = ['api.deezer.com', 'itunes.apple.com'];

// Security limits to prevent DoS via deep recursion or massive data structures
export const MAX_FOLDER_DEPTH = 50;
export const MAX_ALBUMS_PER_FOLDER = 5000;
export const MAX_SUBFOLDERS_PER_FOLDER = 100;
export const MAX_TOTAL_ALBUMS = 10000;
export const MAX_TOTAL_FOLDERS = 2000;

export interface SanitizationContext {
  totalAlbums: number;
  totalFolders: number;
}

// Performance: Pre-compile regexes to avoid re-creation on every sanitization call.
const CONTROL_CHARS_REGEXP = /[\x00-\x1F\x7F\s]/;
const ENCODED_CONTROL_CHARS_REGEXP = /%(0[0-9A-F]|1[0-9A-F]|7F)/i;
const PROTOCOL_RELATIVE_REGEXP = /^\/(?:\/|%2f)/i;

/**
 * Sanitize a URL to prevent XSS via javascript: or other dangerous protocols.
 * Allows only https: and relative paths by default.
 * Enforces a maximum length and blocks control characters to prevent potential DoS or XSS.
 */
export function sanitizeUrl(url: string | undefined, allowedProtocols = ALLOWED_PROTOCOLS): string | undefined {
  if (!url || typeof url !== 'string') return undefined;

  const trimmedUrl = url.trim();

  // Enforce maximum length and block control characters/internal whitespace (including encoded ones)
  if (trimmedUrl.length > MAX_URL_LENGTH ||
      CONTROL_CHARS_REGEXP.test(trimmedUrl) ||
      (trimmedUrl.includes('%') && ENCODED_CONTROL_CHARS_REGEXP.test(trimmedUrl))) {
    return undefined;
  }

  // Performance: Fast-path for common https:// URLs to avoid expensive 'new URL()' calls.
  // If it starts with https:// and passes the character checks above, it's safe for our default protocol.
  if (allowedProtocols === ALLOWED_PROTOCOLS && trimmedUrl.startsWith('https://')) {
    // Ensure no additional colons (potential protocol bypasses) or backslashes
    if (!trimmedUrl.includes(':', 8) && !trimmedUrl.includes('\\')) {
      return trimmedUrl;
    }
  }

  try {
    const parsed = new URL(trimmedUrl);
    if (allowedProtocols.includes(parsed.protocol)) {
      return trimmedUrl;
    }
  } catch (e) {
    // If it's not a valid absolute URL, check if it's a safe relative path.
    // We explicitly exclude URLs with colons (to prevent protocol bypasses)
    // and backslashes (to prevent path normalization bypasses).
    if (trimmedUrl.includes(':') || trimmedUrl.includes('\\')) {
      return undefined;
    }

    // Performance: Avoid redundant toLowerCase() by checking against common encoded variants directly
    const lowerUrl = trimmedUrl.toLowerCase();
    if (lowerUrl.includes('%3a') || lowerUrl.includes('%5c')) {
      return undefined;
    }

    // We explicitly exclude protocol-relative URLs (starting with // or encoded variants) for security.
    if (PROTOCOL_RELATIVE_REGEXP.test(trimmedUrl)) {
      return undefined;
    }

    if (trimmedUrl.startsWith('/') ||
        trimmedUrl.startsWith('./') ||
        trimmedUrl.startsWith('../')) {
      return trimmedUrl;
    }
  }

  return undefined;
}

/**
 * Sanitize an image URL, allowing only safe data:image/ protocols for inline images.
 */
export function sanitizeImageUrl(url: string | undefined): string | undefined {
  if (!url || typeof url !== 'string') return undefined;

  const trimmedUrl = url.trim();

  // Performance: Avoid toLowerCase() unless potentially a data: URL.
  // Most URLs in the app are https:// which are handled by sanitizeUrl.
  if (trimmedUrl.length > 5 && trimmedUrl.slice(0, 5).toLowerCase() === 'data:') {
    const lowerUrl = trimmedUrl.toLowerCase();
    const commaIndex = lowerUrl.indexOf(',');
    if (commaIndex === -1) return undefined;

    const mimePart = lowerUrl.slice(0, commaIndex);
    let decodedMimePart;
    try {
      // Decode to handle percent-encoding bypasses (e.g. svg%2Bxml)
      decodedMimePart = decodeURIComponent(mimePart);
    } catch (e) {
      return undefined;
    }

    // Only allow safe data:image/ protocols (excluding SVG to prevent potential XSS)
    if (decodedMimePart.startsWith('data:image/') && !decodedMimePart.includes('svg+xml')) {
      // Data URLs can be long, but we apply a strict limit to prevent localStorage exhaustion.
      // 256KB is sufficient for high-quality album covers while protecting storage quota.
      if (trimmedUrl.length > 256 * 1024) return undefined;
      return trimmedUrl;
    }
    return undefined;
  }

  return sanitizeUrl(trimmedUrl, ALLOWED_PROTOCOLS);
}

/**
 * Validate if a string is a valid Theme.
 */
export function isValidTheme(theme: any): theme is Theme {
  return typeof theme === 'string' && THEMES.includes(theme as Theme);
}


/**
 * Validate if a string is a valid AlbumViewMode.
 */
export function isValidViewMode(mode: any): mode is AlbumViewMode {
  return typeof mode === 'string' && VIEW_MODES.includes(mode as AlbumViewMode);
}

/**
 * Validate if a string is a valid StreamingProvider.
 */
export function isValidStreamingProvider(provider: any): provider is StreamingProvider {
  return typeof provider === 'string' && STREAMING_PROVIDERS.includes(provider as StreamingProvider);
}

/**
 * Validate if a string is a valid GeistFont.
 */
export function isValidGeistFont(font: any): font is GeistFont {
  return typeof font === 'string' && GEIST_FONTS.includes(font as GeistFont);
}

/**
 * Centralized sanitization for Album objects.
 * Truncates text fields and sanitizes all URLs.
 */
export function sanitizeAlbum(album: any, regenerateId = false): Album {
  const rawId = album.id;
  const isProviderId = typeof rawId === 'string' && (rawId.startsWith('spotify-') || rawId.startsWith('deezer-') || rawId.startsWith('apple-'));
  const id = (regenerateId && !isProviderId) ? crypto.randomUUID() : String(rawId || crypto.randomUUID()).slice(0, MAX_ID_LENGTH);

  const sanitized: Album = {
    id,
    spotifyId: album.spotifyId ? String(album.spotifyId).slice(0, MAX_ID_LENGTH) : undefined,
    name: (typeof album.name === 'string' && album.name ? album.name : String(album.name || 'Unknown Album')).slice(0, MAX_TEXT_LENGTH),
    artist: (typeof album.artist === 'string' && album.artist ? album.artist : String(album.artist || 'Unknown Artist')).slice(0, MAX_TEXT_LENGTH),
    imageUrl: sanitizeImageUrl(album.imageUrl) || '/placeholder.svg',
    releaseDate: album.releaseDate ? String(album.releaseDate).slice(0, MAX_DATE_LENGTH) : undefined,
    totalTracks: Math.max(0, Math.min(1000, Number(album.totalTracks) || 0)),
    spotifyUrl: sanitizeUrl(album.spotifyUrl),
    externalUrl: sanitizeUrl(album.externalUrl),
  };

  if (album._needsHydration) {
    (sanitized as any)._needsHydration = true;
  }

  // Defense-in-depth: Ensure coordinates are finite numbers to prevent rendering-based DoS or crashes
  if (album.position &&
      typeof album.position.x === 'number' && Number.isFinite(album.position.x) &&
      typeof album.position.y === 'number' && Number.isFinite(album.position.y)) {
    sanitized.position = { x: Number(album.position.x), y: Number(album.position.y) };
  }

  return sanitized;
}

/**
 * Hardened JSONP utility that enforces HTTPS, domain whitelisting,
 * prevents parameter pollution, and uses CSPRNG for callback names.
 */
export function jsonp<T>(url: string): Promise<T> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('JSONP is only supported in browser environment'));
  }

  if (url.length > MAX_URL_LENGTH) {
    return Promise.reject(new Error('URL exceeds maximum length'));
  }

  try {
    const parsed = new URL(url);

    // Enforce HTTPS
    if (parsed.protocol !== 'https:') {
      throw new Error(`Insecure JSONP protocol: ${parsed.protocol}`);
    }

    // Domain whitelist check
    if (!TRUSTED_JSONP_DOMAINS.includes(parsed.hostname)) {
      throw new Error(`Untrusted JSONP domain: ${parsed.hostname}`);
    }

    // Prevent parameter pollution / callback injection
    if (parsed.searchParams.has('callback')) {
      throw new Error('URL already contains a callback parameter');
    }
  } catch (e) {
    return Promise.reject(e instanceof Error ? e : new Error('Invalid JSONP URL'));
  }

  return new Promise((resolve, reject) => {
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    const callbackName = `jsonp_cb_${randomArray[0]}_${Date.now()}`;

    const script = document.createElement('script');

    (window as any)[callbackName] = (data: T) => {
      cleanup();
      resolve(data);
    };

    const cleanup = () => {
      delete (window as any)[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    // Use URL searchParams for robust parameter setting
    const finalUrl = new URL(url);
    finalUrl.searchParams.set('callback', callbackName);

    script.src = finalUrl.toString();
    script.onerror = () => {
      cleanup();
      reject(new Error(`JSONP request failed for ${url}`));
    };

    document.body.appendChild(script);
  });
}

/**
 * Recursively sanitize a Folder structure.
 * Supports optional ID regeneration for imports and a custom album mapper.
 * Enforces global limits on total albums and folders to prevent DoS.
 */
export function sanitizeFolder(
  folder: any,
  regenerateIds = false,
  parentId: string | null = folder.parentId ? String(folder.parentId).slice(0, MAX_ID_LENGTH) : null,
  albumMapper: (album: Album, index: number) => Album = (a) => a,
  depth = 0,
  context: SanitizationContext = { totalAlbums: 0, totalFolders: 0 }
): Folder {
  context.totalFolders++;
  const id = regenerateIds ? crypto.randomUUID() : String(folder.id || '').slice(0, MAX_ID_LENGTH);

  const albums: Album[] = [];
  // Defense-in-depth: only process albums if we haven't hit the folder limit
  if (context.totalFolders <= MAX_TOTAL_FOLDERS) {
    if (Array.isArray(folder.albums)) {
      for (let i = 0; i < folder.albums.length && albums.length < MAX_ALBUMS_PER_FOLDER && context.totalAlbums < MAX_TOTAL_ALBUMS; i++) {
        albums.push(albumMapper(sanitizeAlbum(folder.albums[i], regenerateIds), i));
        context.totalAlbums++;
      }
    }
  }

  const subfolders: Folder[] = [];
  if (Array.isArray(folder.subfolders) && depth < MAX_FOLDER_DEPTH) {
    const rawSubfolders = folder.subfolders.slice(0, MAX_SUBFOLDERS_PER_FOLDER);
    for (const sf of rawSubfolders) {
      if (context.totalFolders >= MAX_TOTAL_FOLDERS) break;
      subfolders.push(sanitizeFolder(sf, regenerateIds, id, albumMapper, depth + 1, context));
    }
  }

  return {
    id,
    name: String(folder.name || 'Untitled').slice(0, MAX_NAME_LENGTH),
    parentId,
    albums,
    subfolders,
    isExpanded: Boolean(folder.isExpanded),
    viewMode: isValidViewMode(folder.viewMode) ? folder.viewMode : 'grid',
  };
}

/**
 * Sanitize an array of root folders, enforcing global limits across the entire tree.
 */
export function sanitizeFolderTree(
  rawFolders: any[],
  regenerateIds = false,
  albumMapper?: (album: Album, index: number) => Album
): Folder[] {
  const context: SanitizationContext = { totalAlbums: 0, totalFolders: 0 };
  const sanitized: Folder[] = [];

  if (Array.isArray(rawFolders)) {
    const limitedRoot = rawFolders.slice(0, MAX_SUBFOLDERS_PER_FOLDER);
    for (const f of limitedRoot) {
      if (context.totalFolders >= MAX_TOTAL_FOLDERS) break;
      sanitized.push(sanitizeFolder(f, regenerateIds, null, albumMapper, 0, context));
    }
  }

  return sanitized;
}
