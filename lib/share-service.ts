import LZString from 'lz-string';
import type { Folder } from './types';
import { sanitizeFolder } from './security';

/**
 * Compresses the folders data into a URL-safe string.
 */
export function compressData(folders: Folder[]): string {
  try {
    const json = JSON.stringify(folders);
    return LZString.compressToEncodedURIComponent(json);
  } catch (error) {
    console.error('Failed to compress data:', error);
    return '';
  }
}

/**
 * Decompress the string from the URL back into a Folder array.
 * Sanitizes the data to ensure security.
 */
export function decompressData(compressed: string): Folder[] | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) return null;

    const data = JSON.parse(json);
    if (!Array.isArray(data)) return null;

    // Sanitize the imported data
    return data.map((f: any) => sanitizeFolder(f, true));
  } catch (error) {
    console.error('Failed to decompress data:', error);
    return null;
  }
}

/**
 * Generates a shareable URL for the current window location.
 */
export function generateShareUrl(folders: Folder[]): string {
  const compressed = compressData(folders);
  if (!compressed) return '';

  const url = new URL(window.location.href);
  url.searchParams.set('share', compressed);
  return url.toString();
}
