import LZString from 'lz-string';
import type { Folder, Album } from './types';
import { sanitizeFolder } from './security';

/**
 * Maps a Folder array to a compact format to reduce URL length.
 */
function toCompact(folders: Folder[]): any[] {
  return folders.map(f => ({
    i: f.id,
    n: f.name,
    p: f.parentId,
    e: f.isExpanded ? 1 : 0,
    v: f.viewMode === 'canvas' ? 1 : 0,
    a: f.albums.map(a => ({
      i: a.id,
      s: a.spotifyId,
      n: a.name,
      r: a.artist,
      u: a.imageUrl,
      d: a.releaseDate,
      t: a.totalTracks,
      o: a.spotifyUrl,
      x: a.externalUrl,
      p: a.position ? { x: Math.round(a.position.x), y: Math.round(a.position.y) } : undefined
    })),
    s: toCompact(f.subfolders)
  }));
}

/**
 * Maps a compact format back to a Folder array.
 */
function fromCompact(compact: any[]): any[] {
  return compact.map(f => ({
    id: f.i,
    name: f.n,
    parentId: f.p,
    isExpanded: !!f.e,
    viewMode: f.v === 1 ? 'canvas' : 'grid',
    albums: (f.a || []).map((a: any) => ({
      id: a.i,
      spotifyId: a.s,
      name: a.n,
      artist: a.r,
      imageUrl: a.u,
      releaseDate: a.d,
      totalTracks: a.t,
      spotifyUrl: a.o,
      externalUrl: a.x,
      position: a.p ? { x: a.p.x, y: a.p.y } : undefined
    })),
    subfolders: fromCompact(f.s || [])
  }));
}

/**
 * Compresses the folders data into a URL-safe string using a compact format.
 */
export function compressData(folders: Folder[]): string {
  try {
    const compact = toCompact(folders);
    const json = JSON.stringify(compact);
    return LZString.compressToEncodedURIComponent(json);
  } catch (error) {
    console.error('Failed to compress data:', error);
    return '';
  }
}

/**
 * Decompress the string from the URL back into a Folder array.
 * Sanitizes the data to ensure security.
 * Supports both old JSON format and new compact format.
 */
export function decompressData(compressed: string): Folder[] | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) return null;

    let data = JSON.parse(json);
    if (!Array.isArray(data)) return null;

    // Check if it's the compact format (look for 'i' key instead of 'id')
    if (data.length > 0 && data[0].i && !data[0].id) {
      data = fromCompact(data);
    }

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
