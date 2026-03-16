import type { Album, Folder, Theme, AlbumViewMode, StreamingProvider, GeistFont, AlbumDetails, Track } from './types';
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

// Performance: Caches for tree limit checks to avoid O(N) traversals on every store update.
// Leveraging structural sharing, unmodified subtrees return O(1) cached results.
const treeCountCache = new WeakMap<Folder | Folder[], SanitizationContext>();
const treeDepthCache = new WeakMap<Folder | Folder[], number>();

// Performance: Pre-compile regexes to avoid re-creation on every sanitization call.
export const DISALLOWED_URL_CHARS_REGEXP = /[\x00-\x1F\x7F\x80-\x9F\u202A-\u202E\u2066-\u2069\s]/;
const STRIP_CONTROL_CHARS_REGEXP = /[\x00-\x1F\x7F\x80-\x9F]/g;
const STRIP_BIDI_CHARS_REGEXP = /[\u202A-\u202E\u2066-\u2069]/g;
export const ENCODED_CONTROL_CHARS_REGEXP = /%(0[0-9A-F]|1[0-9A-F]|7F|[89][0-9A-F])/i;
const ENCODED_COLON_OR_BACKSLASH_REGEXP = /%(3A|5C)/i;
const PROTOCOL_RELATIVE_REGEXP = /^\/(?:\/|%2f)/i;
export const SAFE_ID_REGEXP = /^[a-zA-Z0-9\-_]+$/;

/**
 * Sanitize a URL to prevent XSS via javascript: or other dangerous protocols.
 * Allows only https: and relative paths by default.
 * Enforces a maximum length and blocks control characters to prevent potential DoS or XSS.
 */
export function sanitizeUrl(url: string | undefined, allowedProtocols = ALLOWED_PROTOCOLS): string | undefined {
  if (!url || typeof url !== 'string') return undefined;

  // Security: Slice FIRST before trimming or regex tests to prevent DoS from massive whitespace strings
  const slicedUrl = url.slice(0, MAX_URL_LENGTH + 100);
  const trimmedUrl = slicedUrl.trim();

  // Enforce maximum length and block control characters/internal whitespace (including encoded ones)
  if (trimmedUrl.length > MAX_URL_LENGTH ||
      DISALLOWED_URL_CHARS_REGEXP.test(trimmedUrl) ||
      (trimmedUrl.includes('%') && ENCODED_CONTROL_CHARS_REGEXP.test(trimmedUrl))) {
    return undefined;
  }

  // Performance: Fast-path for common https:// URLs to avoid expensive 'new URL()' calls.
  // If it starts with https:// and passes the character checks above, it's safe for our default protocol.
  if (allowedProtocols === ALLOWED_PROTOCOLS && trimmedUrl.startsWith('https://')) {
    // Ensure no additional colons (potential protocol bypasses), backslashes, or credentials (@)
    if (!trimmedUrl.includes(':', 8) && !trimmedUrl.includes('\\') && !trimmedUrl.includes('@')) {
      return trimmedUrl;
    }
  }

  // Performance: Fast-path for relative paths to avoid 'new URL()' which throws.
  if (trimmedUrl.startsWith('/') ||
      trimmedUrl.startsWith('./') ||
      trimmedUrl.startsWith('../')) {

    // Explicitly exclude protocol-relative URLs (starting with // or encoded variants) for security.
    if (PROTOCOL_RELATIVE_REGEXP.test(trimmedUrl)) {
      return undefined;
    }

    // We explicitly exclude URLs with colons (to prevent protocol bypasses)
    // and backslashes (to prevent path normalization bypasses).
    if (trimmedUrl.includes(':') || trimmedUrl.includes('\\')) {
      return undefined;
    }

    // Performance: Avoid redundant string allocation and copy from toLowerCase()
    // by using a case-insensitive regex for encoded characters.
    if (ENCODED_COLON_OR_BACKSLASH_REGEXP.test(trimmedUrl)) {
      return undefined;
    }

    return trimmedUrl;
  }

  try {
    const parsed = new URL(trimmedUrl);
    if (allowedProtocols.includes(parsed.protocol)) {
      // Security: Reject URLs with credentials (username/password) to prevent phishing
      // and certain SSRF/XSS bypasses.
      if (parsed.username || parsed.password) {
        return undefined;
      }
      return trimmedUrl;
    }
  } catch (e) {
    // try/catch fallback is now only for absolute URLs that might be invalid or other cases
  }

  return undefined;
}

/**
 * Sanitize an image URL, allowing only safe data:image/ protocols for inline images.
 */
export function sanitizeImageUrl(url: string | undefined): string | undefined {
  if (!url || typeof url !== 'string') return undefined;

  // Security: Slice FIRST before trimming to prevent DoS from massive whitespace strings.
  // We use a slightly larger slice to account for data URLs which have a higher limit.
  const slicedUrl = url.slice(0, 256 * 1024 + 100);
  const trimmedUrl = slicedUrl.trim();

  // Performance: Avoid toLowerCase() unless potentially a data: URL.
  // Most URLs in the app are https:// which are handled by sanitizeUrl.
  if (trimmedUrl.length > 5 && trimmedUrl.slice(0, 5).toLowerCase() === 'data:') {
    const commaIndex = trimmedUrl.indexOf(',');
    if (commaIndex === -1) return undefined;

    // Performance: Only lowercase the mime part, not the entire data string (which can be 256KB)
    const mimePart = trimmedUrl.slice(0, commaIndex).toLowerCase();
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
 * Sanitize a text field by enforcing length limits and stripping control characters.
 * Preserves valid whitespace and international characters while protecting
 * against injection or storage-based DoS.
 */
export function sanitizeText(text: any, maxLength = MAX_TEXT_LENGTH): string {
  if (text === null || text === undefined) return '';
  const str = String(text);
  // Security: Slice first to minimize work for DoS payloads, then strip control and Bidi chars.
  return str
    .slice(0, maxLength)
    .replace(STRIP_CONTROL_CHARS_REGEXP, '')
    .replace(STRIP_BIDI_CHARS_REGEXP, '');
}

/**
 * Sanitize a Track object by enforcing length limits, safe ID format,
 * and sanitizing the preview URL.
 */
export function sanitizeTrack(track: any, index = 0): Track {
  if (!track || typeof track !== 'object') {
    return {
      id: `track-${index}`,
      title: 'Unknown Track',
      preview: '',
      duration: 0,
    };
  }

  const rawId = String(track.id || index).slice(0, MAX_ID_LENGTH);
  // Security: Enforce safe identifier format for track IDs
  const id = SAFE_ID_REGEXP.test(rawId) ? rawId : `track-${index}`;

  return {
    id,
    title: sanitizeText(track.title || 'Unknown Track', MAX_NAME_LENGTH),
    preview: sanitizeUrl(track.preview) || '',
    duration: Math.max(0, Math.min(3600, Number(track.duration) || 0)),
  };
}

/**
 * Sanitize AlbumDetails object.
 * Truncates text fields, sanitizes track preview URLs, and enforces item limits.
 */
export function sanitizeAlbumDetails(details: any): AlbumDetails {
  if (!details || typeof details !== 'object') {
    return {
      tracks: [],
    };
  }

  const tracks: Track[] = [];
  if (Array.isArray(details.tracks)) {
    // Limit to 100 tracks to prevent DoS from massive API responses
    for (let i = 0; i < details.tracks.length && tracks.length < 100; i++) {
      tracks.push(sanitizeTrack(details.tracks[i], i));
    }
  }

  const sanitized: AlbumDetails = {
    tracks,
    label: details.label ? sanitizeText(details.label) : undefined,
  };

  if (Array.isArray(details.contributors)) {
    // Limit to 50 contributors
    sanitized.contributors = details.contributors
      .slice(0, 50)
      .map((c: any) => sanitizeText(c, MAX_NAME_LENGTH));
  }

  return sanitized;
}

/**
 * Sanitize a partial sync state object, enforcing types and security constraints.
 * Centralized logic used for both applySyncState and onRehydrateStorage.
 */
export function sanitizeSyncState(incoming: any): any {
  const s: any = {};

  // Security: Harden numeric state validation against future-dated injections or overflow.
  const isStrictPosFinite = (n: any) => typeof n === 'number' && Number.isFinite(n) && n > 0;
  const isSaneTimestamp = (n: any) => isStrictPosFinite(n) && n < Date.now() + (365 * 24 * 60 * 60 * 1000);
  const isSaneExpiry = (n: any) => isStrictPosFinite(n) && n <= 365 * 24 * 60 * 60; // Max 1 year expiry

  if (incoming.folders !== undefined) s.folders = Array.isArray(incoming.folders) ? sanitizeFolderTree(incoming.folders) : [];

  if (incoming.selectedFolderId !== undefined) {
    if (typeof incoming.selectedFolderId === 'string') {
      const sliced = incoming.selectedFolderId.slice(0, MAX_ID_LENGTH);
      s.selectedFolderId = SAFE_ID_REGEXP.test(sliced) ? sliced : null;
    } else {
      s.selectedFolderId = null;
    }
  }

  if (incoming.streamingProvider !== undefined) s.streamingProvider = isValidStreamingProvider(incoming.streamingProvider) ? incoming.streamingProvider : 'deezer';
  if (incoming.hasSetPreference !== undefined) s.hasSetPreference = Boolean(incoming.hasSetPreference);

  if (incoming.spotifyToken !== undefined) {
    if (typeof incoming.spotifyToken === 'string' && incoming.spotifyToken.length > 0) {
      const t = incoming.spotifyToken.slice(0, MAX_TOKEN_LENGTH);
      s.spotifyToken = (!DISALLOWED_URL_CHARS_REGEXP.test(t) && !ENCODED_CONTROL_CHARS_REGEXP.test(t)) ? t : null;
    } else {
      s.spotifyToken = null;
    }
  }

  if (incoming.spotifyTokenExpiry !== undefined) s.spotifyTokenExpiry = isSaneExpiry(incoming.spotifyTokenExpiry) ? incoming.spotifyTokenExpiry : null;
  if (incoming.spotifyTokenTimestamp !== undefined) s.spotifyTokenTimestamp = isSaneTimestamp(incoming.spotifyTokenTimestamp) ? incoming.spotifyTokenTimestamp : null;
  if (incoming.theme !== undefined) s.theme = isValidTheme(incoming.theme) ? incoming.theme : 'industrial';
  if (incoming.geistFont !== undefined) s.geistFont = isValidGeistFont(incoming.geistFont) ? incoming.geistFont : 'mono';

  if (incoming.lastUpdated !== undefined) {
    s.lastUpdated = isSaneTimestamp(incoming.lastUpdated) ? incoming.lastUpdated : Date.now();
  }
  return s;
}

/**
 * Centralized sanitization for Album objects.
 * Truncates text fields and sanitizes all URLs.
 */
export function sanitizeAlbum(album: any, regenerateId = false): Album {
  if (!album || typeof album !== 'object') {
    return {
      id: crypto.randomUUID(),
      name: 'Unknown Album',
      artist: 'Unknown Artist',
      imageUrl: '/placeholder.svg',
      totalTracks: 0,
    };
  }

  const rawId = album.id;
  const isProviderId = typeof rawId === 'string' && (rawId.startsWith('spotify-') || rawId.startsWith('deezer-') || rawId.startsWith('apple-'));
  let id = (regenerateId && !isProviderId) ? crypto.randomUUID() : String(rawId || crypto.randomUUID()).slice(0, MAX_ID_LENGTH);

  // Security: Enforce safe identifier format for album IDs to prevent injection
  if (!SAFE_ID_REGEXP.test(id)) {
    id = crypto.randomUUID();
  }

  const spotifyId = album.spotifyId ? String(album.spotifyId).slice(0, MAX_ID_LENGTH) : undefined;
  const sanitizedSpotifyId = (spotifyId && SAFE_ID_REGEXP.test(spotifyId)) ? spotifyId : undefined;

  const sanitized: Album = {
    id,
    spotifyId: sanitizedSpotifyId,
    name: sanitizeText(album.name || 'Unknown Album', MAX_TEXT_LENGTH),
    artist: sanitizeText(album.artist || 'Unknown Artist', MAX_TEXT_LENGTH),
    imageUrl: sanitizeImageUrl(album.imageUrl) || '/placeholder.svg',
    releaseDate: album.releaseDate ? sanitizeText(album.releaseDate, MAX_DATE_LENGTH) : undefined,
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
 * Recursively count albums and folders in a tree.
 * Performance: Uses WeakMap caching to skip O(N) traversals for stable subtrees.
 */
export function countTreeItems(target: Folder[] | Folder): SanitizationContext {
  const cached = treeCountCache.get(target);
  if (cached) return cached;

  const result = { totalAlbums: 0, totalFolders: 0 };

  if (Array.isArray(target)) {
    for (const folder of target) {
      const childContext = countTreeItems(folder);
      result.totalFolders += childContext.totalFolders;
      result.totalAlbums += childContext.totalAlbums;
    }
  } else {
    result.totalFolders = 1;
    result.totalAlbums = target.albums.length;
    const subfoldersContext = countTreeItems(target.subfolders);
    result.totalFolders += subfoldersContext.totalFolders;
    result.totalAlbums += subfoldersContext.totalAlbums;
  }

  treeCountCache.set(target, result);
  return result;
}

/**
 * Calculate the maximum depth of a folder subtree.
 * Performance: Uses WeakMap caching to skip redundant O(depth) traversals for stable subtrees.
 */
export function getTreeDepth(target: Folder[] | Folder): number {
  const cached = treeDepthCache.get(target);
  if (cached !== undefined) return cached;

  let result = 0;

  if (Array.isArray(target)) {
    if (target.length > 0) {
      result = Math.max(...target.map(f => getTreeDepth(f)));
    }
  } else {
    result = 1 + getTreeDepth(target.subfolders);
  }

  treeDepthCache.set(target, result);
  return result;
}

/**
 * Recursively sanitize a Folder structure.
 * Supports optional ID regeneration for imports and a custom album mapper.
 * Enforces global limits on total albums and folders to prevent DoS.
 */
export function sanitizeFolder(
  folder: any,
  regenerateIds = false,
  parentId: string | null = (folder && folder.parentId && typeof folder.parentId === 'string' && SAFE_ID_REGEXP.test(folder.parentId.slice(0, MAX_ID_LENGTH)))
    ? folder.parentId.slice(0, MAX_ID_LENGTH)
    : null,
  albumMapper: (album: Album, index: number) => Album = (a) => a,
  depth = 0,
  context: SanitizationContext = { totalAlbums: 0, totalFolders: 0 }
): Folder {
  context.totalFolders++;

  if (!folder || typeof folder !== 'object') {
    return {
      id: crypto.randomUUID(),
      name: 'Untitled',
      parentId: parentId,
      albums: [],
      subfolders: [],
      isExpanded: true,
      viewMode: 'grid',
    };
  }

  let id = regenerateIds ? crypto.randomUUID() : String(folder.id || '').slice(0, MAX_ID_LENGTH);

  // Security: Enforce safe identifier format for folder IDs
  if (!SAFE_ID_REGEXP.test(id)) {
    id = crypto.randomUUID();
  }

  const albums: Album[] = [];
  // Defense-in-depth: only process albums if we haven't hit the folder limit
  if (context.totalFolders <= MAX_TOTAL_FOLDERS) {
    if (Array.isArray(folder.albums)) {
      for (let i = 0; i < folder.albums.length && albums.length < MAX_ALBUMS_PER_FOLDER && context.totalAlbums < MAX_TOTAL_ALBUMS; i++) {
        const sanitized = sanitizeAlbum(folder.albums[i], regenerateIds);
        albums.push(albumMapper(sanitized, i));
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
    name: sanitizeText(folder.name || 'Untitled', MAX_NAME_LENGTH),
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
  albumMapper?: (album: Album, index: number) => Album,
  initialContext?: SanitizationContext
): Folder[] {
  const context: SanitizationContext = initialContext ? { ...initialContext } : { totalAlbums: 0, totalFolders: 0 };
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
