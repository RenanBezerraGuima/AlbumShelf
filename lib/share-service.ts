import LZString from 'lz-string';
import type { Folder, Album, StreamingProvider } from './types';
import { sanitizeFolder } from './security';

interface SharePayload {
  v: number; // version
  p: StreamingProvider;
  f: any[]; // folders
}

/**
 * Maps a Folder array to a compact format to reduce URL length.
 * Strips metadata from albums that can be hydrated via provider IDs.
 */
function toCompact(folders: Folder[]): any[] {
  return folders.map(f => ({
    i: f.id,
    n: f.name,
    p: f.parentId,
    e: f.isExpanded ? 1 : 0,
    v: f.viewMode === 'canvas' ? 1 : 0,
    a: f.albums.map(a => {
      // If it's a provider album, we only need the ID and position
      const isProviderAlbum = a.id.startsWith('spotify-') || a.id.startsWith('deezer-') || a.id.startsWith('apple-');

      if (isProviderAlbum) {
        return {
          i: a.id,
          p: a.position ? { x: Math.round(a.position.x), y: Math.round(a.position.y) } : undefined
        };
      }

      // Fallback for manual albums (if any exist)
      return {
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
      };
    }),
    s: toCompact(f.subfolders)
  }));
}

/**
 * Maps a compact format back to a Folder array.
 * Albums will be missing metadata if they are provider-linked.
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
      name: a.n || 'Loading...', // Placeholder
      artist: a.r || '',
      imageUrl: a.u || '',
      releaseDate: a.d,
      totalTracks: a.t || 0,
      spotifyUrl: a.o,
      externalUrl: a.x,
      position: a.p ? { x: a.p.x, y: a.p.y } : undefined,
      _needsHydration: !a.n // Internal flag for hydration
    })),
    subfolders: fromCompact(f.s || [])
  }));
}

/**
 * Compresses the folders data into a URL-safe string using a compact format.
 */
export function compressData(folders: Folder[], provider: StreamingProvider): string {
  try {
    const payload: SharePayload = {
      v: 2, // New version with reference-based sharing
      p: provider,
      f: toCompact(folders)
    };
    const json = JSON.stringify(payload);
    return LZString.compressToEncodedURIComponent(json);
  } catch (error) {
    console.error('Failed to compress data:', error);
    return '';
  }
}

/**
 * Decompress the string from the URL back into a Folder array.
 * Sanitizes the data to ensure security.
 * Supports both old formats and new compact format.
 */
export function decompressData(compressed: string): { folders: Folder[], provider?: StreamingProvider } | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) return null;

    let rawData = JSON.parse(json);

    // Version 2: Reference-based sharing
    if (rawData.v === 2 && rawData.f) {
      return {
        folders: fromCompact(rawData.f).map((f: any) => sanitizeFolder(f, true)),
        provider: rawData.p
      };
    }

    // Version 1: Compact format (previous optimization)
    if (Array.isArray(rawData) && rawData.length > 0 && rawData[0].i && !rawData[0].id) {
      return {
        folders: fromCompact(rawData).map((f: any) => sanitizeFolder(f, true))
      };
    }

    // Legacy Version 0: Full JSON
    if (Array.isArray(rawData)) {
      return {
        folders: rawData.map((f: any) => sanitizeFolder(f, true))
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to decompress data:', error);
    return null;
  }
}

/**
 * Generates a shareable URL for the current window location.
 */
export function generateShareUrl(folders: Folder[], provider: StreamingProvider): string {
  const compressed = compressData(folders, provider);
  if (!compressed) return '';

  const url = new URL(window.location.href);
  url.searchParams.set('share', compressed);
  return url.toString();
}
