const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Sanitize a URL to prevent XSS via javascript: or other dangerous protocols.
 * Allows only http:, https: and relative paths by default.
 */
export function sanitizeUrl(url: string | undefined, allowedProtocols = ALLOWED_PROTOCOLS): string | undefined {
  if (!url) return undefined;

  const trimmedUrl = url.trim();

  try {
    const parsed = new URL(trimmedUrl);
    if (allowedProtocols.includes(parsed.protocol)) {
      return trimmedUrl;
    }
  } catch (e) {
    // If it's not a valid absolute URL, check if it's a safe relative path
    if (trimmedUrl.startsWith('/') || trimmedUrl.startsWith('./') || trimmedUrl.startsWith('../')) {
      return trimmedUrl;
    }
  }

  return undefined;
}

/**
 * Sanitize an image URL, allowing only safe data:image/ protocols for inline images.
 */
export function sanitizeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  const trimmedUrl = url.trim();

  if (trimmedUrl.startsWith('data:')) {
    // Only allow data:image/ protocols
    if (trimmedUrl.startsWith('data:image/')) {
      return trimmedUrl;
    }
    return undefined;
  }

  return sanitizeUrl(trimmedUrl, ALLOWED_PROTOCOLS);
}
