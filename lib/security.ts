import type { Album } from './types';

const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const MAX_URL_LENGTH = 2048;
const MAX_TEXT_LENGTH = 200;

/**
 * Sanitize a URL to prevent XSS via javascript: or other dangerous protocols.
 * Allows only http:, https: and relative paths by default.
 * Enforces a maximum length to prevent potential DoS or memory issues.
 */
export function sanitizeUrl(url: string | undefined, allowedProtocols = ALLOWED_PROTOCOLS): string | undefined {
  if (!url || typeof url !== 'string') return undefined;

  const trimmedUrl = url.trim();

  // Enforce maximum length and block control characters/internal whitespace
  if (trimmedUrl.length > MAX_URL_LENGTH || /[\x00-\x1F\x7F\s]/.test(trimmedUrl)) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmedUrl);
    if (allowedProtocols.includes(parsed.protocol)) {
      return trimmedUrl;
    }
  } catch (e) {
    // If it's not a valid absolute URL, check if it's a safe relative path.
    // We explicitly exclude protocol-relative URLs (starting with //, /\, or encoded variants) for security.
    const isProtocolRelative =
      trimmedUrl.startsWith('//') ||
      trimmedUrl.startsWith('/\\') ||
      trimmedUrl.startsWith('\\/') ||
      trimmedUrl.toLowerCase().startsWith('/%5c') ||
      trimmedUrl.toLowerCase().startsWith('/%2f');

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
 * Centralized sanitization for Album objects.
 * Truncates text fields and sanitizes all URLs.
 */
export function sanitizeAlbum(album: any): Album {
  return {
    id: String(album.id || '').slice(0, 100),
    spotifyId: album.spotifyId ? String(album.spotifyId).slice(0, 100) : undefined,
    name: String(album.name || 'Unknown Album').slice(0, MAX_TEXT_LENGTH),
    artist: String(album.artist || 'Unknown Artist').slice(0, MAX_TEXT_LENGTH),
    imageUrl: sanitizeImageUrl(String(album.imageUrl || '')) || '/placeholder.svg',
    releaseDate: album.releaseDate ? String(album.releaseDate).slice(0, 50) : undefined,
    totalTracks: Number(album.totalTracks) || 0,
    spotifyUrl: sanitizeUrl(album.spotifyUrl ? String(album.spotifyUrl) : undefined),
    externalUrl: sanitizeUrl(album.externalUrl ? String(album.externalUrl) : undefined),
  };
}
