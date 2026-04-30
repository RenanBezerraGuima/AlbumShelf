import type { Album, Folder, Theme, AlbumViewMode, SortOrder, StreamingProvider, GeistFont, AlbumDetails, Track } from './types';
import { THEMES, VIEW_MODES, SORT_ORDERS, STREAMING_PROVIDERS, GEIST_FONTS } from './types';

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
// Includes control, Bidi, and invisible characters (U+AD, U+A0, U+200B-U+200F, U+202A-U+202E, U+2060, U+2066-U+2069, U+FEFF).
export const DISALLOWED_URL_CHARS_REGEXP = /[\x00-\x1F\x7F\x80-\x9F\xAD\u00A0\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF\s]/;
// Performance: Single-pass regex for both detection (fast-path) and stripping.
const INVALID_CHARS_REGEXP = /[\x00-\x1F\x7F\x80-\x9F\xAD\u00A0\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/;
const INVALID_CHARS_GLOBAL_REGEXP = new RegExp(INVALID_CHARS_REGEXP.source, 'g');
// Security: Block encoded control characters, Soft Hyphens (%AD), and NBSP (%A0).
export const ENCODED_CONTROL_CHARS_REGEXP = /%(0[0-9A-F]|1[0-9A-F]|7F|[89][0-9A-F]|AD|A0)/i;
const ENCODED_COLON_OR_BACKSLASH_REGEXP = /%(3A|5C)/i;
const PROTOCOL_RELATIVE_REGEXP = /^\/(?:\/|%2f)/i;
export const SAFE_ID_REGEXP = /^[a-zA-Z0-9\-_]+$/;

/**
 * Internal helper for URL sanitization that skips slicing and trimming if already performed.
 */
function sanitizeUrlInternal(trimmedUrl: string, allowedProtocols = ALLOWED_PROTOCOLS): string | undefined {
  // Enforce maximum length and block control characters/internal whitespace (including encoded ones)
  if (trimmedUrl.length > MAX_URL_LENGTH ||
      DISALLOWED_URL_CHARS_REGEXP.test(trimmedUrl) ||
      (trimmedUrl.includes('%') && ENCODED_CONTROL_CHARS_REGEXP.test(trimmedUrl))) {
    return undefined;
  }

  // Performance: Fast-path for common https:// URLs to avoid expensive 'new URL()' calls.
  if (allowedProtocols === ALLOWED_PROTOCOLS && trimmedUrl.startsWith('https://')) {
    if (!trimmedUrl.includes(':', 8) && !trimmedUrl.includes('\\') && !trimmedUrl.includes('@')) {
      return trimmedUrl;
    }
  }

  // Performance: Fast-path for relative paths
  if (trimmedUrl.startsWith('/') ||
      trimmedUrl.startsWith('./') ||
      trimmedUrl.startsWith('../')) {

    if (PROTOCOL_RELATIVE_REGEXP.test(trimmedUrl)) {
      return undefined;
    }

    if (trimmedUrl.includes(':') || trimmedUrl.includes('\\')) {
      return undefined;
    }

    if (ENCODED_COLON_OR_BACKSLASH_REGEXP.test(trimmedUrl)) {
      return undefined;
    }

    return trimmedUrl;
  }

  try {
    const parsed = new URL(trimmedUrl);
    if (allowedProtocols.includes(parsed.protocol)) {
      if (parsed.username || parsed.password) {
        return undefined;
      }
      return trimmedUrl;
    }
  } catch (e) {}

  return undefined;
}

/**
 * Sanitize a URL to prevent XSS via javascript: or other dangerous protocols.
 * Allows only https: and relative paths by default.
 */
export function sanitizeUrl(url: string | undefined, allowedProtocols = ALLOWED_PROTOCOLS): string | undefined {
  if (!url || typeof url !== 'string') return undefined;

  // Security: Slice FIRST before trimming or regex tests to prevent DoS from massive whitespace strings
  const slicedUrl = url.slice(0, MAX_URL_LENGTH + 100);
  const trimmedUrl = slicedUrl.trim();

  return sanitizeUrlInternal(trimmedUrl, allowedProtocols);
}

/**
 * Sanitize an image URL, allowing only safe data:image/ protocols for inline images.
 */
export function sanitizeImageUrl(url: string | undefined): string | undefined {
  if (!url || typeof url !== 'string') return undefined;

  // Security: Slice FIRST before trimming.
  const slicedUrl = url.slice(0, 256 * 1024 + 100);
  const trimmedUrl = slicedUrl.trim();

  // Performance: Avoid toLowerCase() unless potentially a data: URL.
  if (trimmedUrl.length > 5 && trimmedUrl.slice(0, 5).toLowerCase() === 'data:') {
    const commaIndex = trimmedUrl.indexOf(',');
    if (commaIndex === -1) return undefined;

    const mimePart = trimmedUrl.slice(0, commaIndex).toLowerCase();
    let decodedMimePart;
    try {
      decodedMimePart = decodeURIComponent(mimePart);
    } catch (e) {
      return undefined;
    }

    if (decodedMimePart.startsWith('data:image/') && !decodedMimePart.includes('svg+xml')) {
      if (trimmedUrl.length > 256 * 1024) return undefined;
      return trimmedUrl;
    }
    return undefined;
  }

  // Performance: Directly call internal helper to avoid redundant slicing and trimming.
  return sanitizeUrlInternal(trimmedUrl, ALLOWED_PROTOCOLS);
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
 * Validate if a string is a valid SortOrder.
 */
export function isValidSortOrder(order: any): order is SortOrder {
  return typeof order === 'string' && SORT_ORDERS.includes(order as SortOrder);
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
 * Performance: Fast-path .test() avoids .replace() allocations for safe strings.
 */
export function sanitizeText(text: any, maxLength = MAX_TEXT_LENGTH): string {
  if (text === null || text === undefined) return '';

  // Performance: Skip String() conversion if already a string
  const str = typeof text === 'string' ? text : String(text);

  // Security: Slice first to minimize work for DoS payloads.
  const sliced = str.length > maxLength ? str.slice(0, maxLength) : str;

  // Performance: Use non-global .test() to skip .replace() for safe strings.
  if (!INVALID_CHARS_REGEXP.test(sliced)) {
    return sliced;
  }

  return sliced.replace(INVALID_CHARS_GLOBAL_REGEXP, '');
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

  const title = track.title
    ? (track.title === 'Unknown Track' ? 'Unknown Track' : sanitizeText(track.title, MAX_NAME_LENGTH))
    : 'Unknown Track';
  const preview = sanitizeUrl(track.preview) || '';
  const duration = Math.max(0, Math.min(3600, Number(track.duration) || 0));

  // Performance: Return original reference if no changes were made to preserve structural sharing.
  if (
    track.id === id &&
    track.title === title &&
    track.preview === preview &&
    track.duration === duration
  ) {
    return track as Track;
  }

  return {
    id,
    title,
    preview,
    duration,
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
  // Security: Restrict timestamps to a max of 5 minutes in the future to allow for clock skew while preventing injection.
  const isSaneTimestamp = (n: any) => isStrictPosFinite(n) && n < Date.now() + (5 * 60 * 1000);
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

  // Performance: Bypass sanitizeText for default strings to avoid unnecessary regex checks.
  const name = album.name
    ? (album.name === 'Unknown Album' ? 'Unknown Album' : sanitizeText(album.name, MAX_TEXT_LENGTH))
    : 'Unknown Album';
  const artist = album.artist
    ? (album.artist === 'Unknown Artist' ? 'Unknown Artist' : sanitizeText(album.artist, MAX_TEXT_LENGTH))
    : 'Unknown Artist';
  const imageUrl = album.imageUrl === '/placeholder.svg' ? '/placeholder.svg' : (sanitizeImageUrl(album.imageUrl) || '/placeholder.svg');
  const releaseDate = album.releaseDate ? sanitizeText(album.releaseDate, MAX_DATE_LENGTH) : undefined;
  const totalTracks = Math.max(0, Math.min(1000, Number(album.totalTracks) || 0));
  const spotifyUrl = sanitizeUrl(album.spotifyUrl);
  const externalUrl = sanitizeUrl(album.externalUrl);

  // Performance: Return original reference if no changes were made to preserve structural sharing.
  if (
    !regenerateId &&
    album.id === id &&
    album.spotifyId === sanitizedSpotifyId &&
    album.name === name &&
    album.artist === artist &&
    album.imageUrl === imageUrl &&
    album.releaseDate === releaseDate &&
    album.totalTracks === totalTracks &&
    album.spotifyUrl === spotifyUrl &&
    album.externalUrl === externalUrl &&
    !album._needsHydration
  ) {
    return album as Album;
  }

  const sanitized: Album = {
    id,
    spotifyId: sanitizedSpotifyId,
    name,
    artist,
    imageUrl,
    releaseDate,
    totalTracks,
    spotifyUrl,
    externalUrl,
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
    for (let i = 0; i < target.length; i++) {
      const folder = target[i];
      const childContext = countTreeItems(folder);
      result.totalFolders += childContext.totalFolders;
      result.totalAlbums += childContext.totalAlbums;
    }
  } else {
    const subfoldersContext = countTreeItems(target.subfolders);
    result.totalFolders = 1 + subfoldersContext.totalFolders;
    result.totalAlbums = target.albums.length + subfoldersContext.totalAlbums;
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
    // Performance: Avoid .map() and spread operator to eliminate intermediate array
    // allocations and reduce overhead in the recursive path.
    for (let i = 0; i < target.length; i++) {
      const depth = getTreeDepth(target[i]);
      if (depth > result) result = depth;
    }
  } else {
    const subfoldersDepth = getTreeDepth(target.subfolders);
    result = 1 + subfoldersDepth;
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

  const name = folder.name ? (folder.name === 'Untitled' ? 'Untitled' : sanitizeText(folder.name, MAX_NAME_LENGTH)) : 'Untitled';
  const isExpanded = Boolean(folder.isExpanded);
  const viewMode = isValidViewMode(folder.viewMode) ? folder.viewMode : 'grid';
  const sortOrder = isValidSortOrder(folder.sortOrder) ? folder.sortOrder : 'manual';

  let changed = false;
  const albums: Album[] = [];
  const rawAlbums = Array.isArray(folder.albums) ? folder.albums : [];
  if (!Array.isArray(folder.albums)) changed = true;

  // Defense-in-depth: only process albums if we haven't hit the folder limit
  if (context.totalFolders <= MAX_TOTAL_FOLDERS) {
    // Performance: Limited loop avoids unnecessary .slice() allocation
    for (let i = 0; i < rawAlbums.length && albums.length < MAX_ALBUMS_PER_FOLDER && context.totalAlbums < MAX_TOTAL_ALBUMS; i++) {
      const original = rawAlbums[i];
      const sanitized = sanitizeAlbum(original, regenerateIds);
      const mapped = albumMapper(sanitized, i);
      if (mapped !== original) {
        changed = true;
      }
      albums.push(mapped);
      context.totalAlbums++;
    }
  }
  if (albums.length !== rawAlbums.length) changed = true;

  const subfolders: Folder[] = [];
  const rawSubfolders = Array.isArray(folder.subfolders) ? folder.subfolders : [];
  if (!Array.isArray(folder.subfolders)) changed = true;

  if (depth < MAX_FOLDER_DEPTH) {
    // Performance: Iterating with a limit directly avoids .slice() array allocation.
    const maxSubfolders = Math.min(rawSubfolders.length, MAX_SUBFOLDERS_PER_FOLDER);
    for (let i = 0; i < maxSubfolders; i++) {
      if (context.totalFolders >= MAX_TOTAL_FOLDERS) {
        break;
      }
      const original = rawSubfolders[i];
      const sanitized = sanitizeFolder(original, regenerateIds, id, albumMapper, depth + 1, context);
      if (sanitized !== original) {
        changed = true;
      }
      subfolders.push(sanitized);
    }
  }
  if (subfolders.length !== rawSubfolders.length) changed = true;

  // Performance: Return original reference if no changes were made to preserve structural sharing.
  if (
    !regenerateIds &&
    !changed &&
    folder.id === id &&
    folder.name === name &&
    folder.parentId === parentId &&
    folder.isExpanded === isExpanded &&
    folder.viewMode === viewMode &&
    folder.sortOrder === sortOrder
  ) {
    return folder as Folder;
  }

  return {
    id,
    name,
    parentId,
    albums,
    subfolders,
    isExpanded,
    viewMode,
    sortOrder,
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

  let changed = false;
  if (Array.isArray(rawFolders)) {
    // Performance: Iterating with a limit directly avoids .slice() array allocation.
    const maxRoot = Math.min(rawFolders.length, MAX_SUBFOLDERS_PER_FOLDER);
    for (let i = 0; i < maxRoot; i++) {
      if (context.totalFolders >= MAX_TOTAL_FOLDERS) break;
      const original = rawFolders[i];
      const result = sanitizeFolder(original, regenerateIds, null, albumMapper, 0, context);
      if (result !== original) {
        changed = true;
      }
      sanitized.push(result);
    }
    if (sanitized.length !== rawFolders.length) changed = true;
  } else {
    changed = true;
  }

  // Performance: Return original reference if no changes were made to preserve structural sharing.
  if (!regenerateIds && !changed && Array.isArray(rawFolders)) {
    return rawFolders as Folder[];
  }

  return sanitized;
}
