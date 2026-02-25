import type { Album, Folder, Theme, AlbumViewMode, StreamingProvider, GeistFont } from './types';
import { THEMES, VIEW_MODES, STREAMING_PROVIDERS, GEIST_FONTS } from './types';

const ALLOWED_PROTOCOLS = ['https:'];
const MAX_URL_LENGTH = 2048;
export const MAX_TEXT_LENGTH = 200;
export const MAX_ID_LENGTH = 100;
export const MAX_NAME_LENGTH = 100;
export const MAX_DATE_LENGTH = 50;

export const TRUSTED_JSONP_DOMAINS = ['api.deezer.com', 'itunes.apple.com'];

// Security limits to prevent DoS via deep recursion or massive data structures
export const MAX_FOLDER_DEPTH = 50;
export const MAX_ALBUMS_PER_FOLDER = 5000;
export const MAX_SUBFOLDERS_PER_FOLDER = 100;
export const MAX_TOTAL_ALBUMS = 10000;

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
      /[\x00-\x1F\x7F\s]/.test(trimmedUrl) ||
      /%(0[0-9A-F]|1[0-9A-F]|7F)/i.test(trimmedUrl)) {
    return undefined;
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
    const lowerUrl = trimmedUrl.toLowerCase();
    if (trimmedUrl.includes(':') || lowerUrl.includes('%3a') ||
        trimmedUrl.includes('\\') || lowerUrl.includes('%5c')) {
      return undefined;
    }

    // We explicitly exclude protocol-relative URLs (starting with // or encoded variants) for security.
    const isProtocolRelative = trimmedUrl.startsWith('//') || trimmedUrl.toLowerCase().startsWith('/%2f');

    if ((trimmedUrl.startsWith('/') && !isProtocolRelative) ||
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
  const lowerUrl = trimmedUrl.toLowerCase();

  if (lowerUrl.startsWith('data:')) {
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
  const isProviderId = album.id?.startsWith?.('spotify-') || album.id?.startsWith?.('deezer-') || album.id?.startsWith?.('apple-');
  const id = (regenerateId && !isProviderId) ? crypto.randomUUID() : String(album.id || crypto.randomUUID()).slice(0, MAX_ID_LENGTH);

  const sanitized: Album = {
    id,
    spotifyId: album.spotifyId ? String(album.spotifyId).slice(0, MAX_ID_LENGTH) : undefined,
    name: String(album.name || 'Unknown Album').slice(0, MAX_TEXT_LENGTH),
    artist: String(album.artist || 'Unknown Artist').slice(0, MAX_TEXT_LENGTH),
    imageUrl: sanitizeImageUrl(String(album.imageUrl || '')) || '/placeholder.svg',
    releaseDate: album.releaseDate ? String(album.releaseDate).slice(0, MAX_DATE_LENGTH) : undefined,
    totalTracks: Math.max(0, Math.min(1000, Number(album.totalTracks) || 0)),
    spotifyUrl: sanitizeUrl(album.spotifyUrl ? String(album.spotifyUrl) : undefined),
    externalUrl: sanitizeUrl(album.externalUrl ? String(album.externalUrl) : undefined),
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
 * Recursively sanitize a Folder structure.
 * Supports optional ID regeneration for imports and a custom album mapper.
 */
export function sanitizeFolder(
  folder: any,
  regenerateIds = false,
  parentId: string | null = folder.parentId ? String(folder.parentId).slice(0, MAX_ID_LENGTH) : null,
  albumMapper: (album: Album, index: number) => Album = (a) => a,
  depth = 0,
  context = { totalAlbums: 0 }
): Folder {
  const id = regenerateIds ? crypto.randomUUID() : String(folder.id || '').slice(0, MAX_ID_LENGTH);

  const albums: Album[] = [];
  if (Array.isArray(folder.albums)) {
    for (let i = 0; i < folder.albums.length && albums.length < MAX_ALBUMS_PER_FOLDER && context.totalAlbums < MAX_TOTAL_ALBUMS; i++) {
      albums.push(albumMapper(sanitizeAlbum(folder.albums[i], regenerateIds), i));
      context.totalAlbums++;
    }
  }

  return {
    id,
    name: String(folder.name || 'Untitled').slice(0, MAX_NAME_LENGTH),
    parentId,
    albums,
    subfolders: Array.isArray(folder.subfolders) && depth < MAX_FOLDER_DEPTH
      ? folder.subfolders
          .slice(0, MAX_SUBFOLDERS_PER_FOLDER)
          .map((sf: any) => sanitizeFolder(sf, regenerateIds, id, albumMapper, depth + 1, context))
      : [],
    isExpanded: Boolean(folder.isExpanded),
    viewMode: isValidViewMode(folder.viewMode) ? folder.viewMode : 'grid',
  };
}
