import { describe, it, expect } from 'vitest';
import { decompressData, compressData } from './share-service';
import { MAX_FOLDER_DEPTH, MAX_SUBFOLDERS_PER_FOLDER, MAX_ALBUMS_PER_FOLDER } from './security';
import LZString from 'lz-string';

describe('Share Service DoS Protection', () => {
  it('should handle deeply nested compact data by truncating it', () => {
    // Create a structure that exceeds the MAX_FOLDER_DEPTH
    const depth = MAX_FOLDER_DEPTH * 2;

    let currentFolders: any[] = [];
    let root = currentFolders;

    for (let i = 0; i < depth; i++) {
      const nextFolder = { i: `f-${i}`, n: `Folder ${i}`, s: [] };
      currentFolders.push(nextFolder);
      currentFolders = nextFolder.s;
    }

    const payload = {
      v: 2,
      p: 'deezer',
      f: root
    };

    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payload));

    // This should not throw "RangeError: Maximum call stack size exceeded"
    const result = decompressData(compressed);
    expect(result).not.toBeNull();

    // Verify truncation.
    let count = 0;
    let current = result?.folders[0];
    while (current) {
      count++;
      current = current.subfolders[0];
    }

    expect(count).toBe(51);
  });

  it('should not hang with a massive number of folders in a flat array', () => {
    const width = 5000; // Large number of folders
    const rootFolders = Array.from({ length: width }, (_, i) => ({
      i: `f-${i}`,
      n: `Folder ${i}`
    }));

    const payload = {
      v: 2,
      p: 'deezer',
      f: rootFolders
    };

    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payload));

    // This should complete quickly and result in a limited number of folders
    const startTime = Date.now();
    const result = decompressData(compressed);
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(1000); // Should be very fast
    expect(result?.folders.length).toBeLessThanOrEqual(MAX_SUBFOLDERS_PER_FOLDER);
  });

  it('should limit the number of albums per folder during decompression', () => {
    const massiveAlbums = Array.from({ length: MAX_ALBUMS_PER_FOLDER + 100 }, (_, i) => ({
      i: `a-${i}`,
      n: `Album ${i}`
    }));

    const payload = {
      v: 2,
      p: 'deezer',
      f: [{ i: 'f1', n: 'Folder 1', a: massiveAlbums }]
    };

    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
    const result = decompressData(compressed);

    expect(result?.folders[0].albums.length).toBe(MAX_ALBUMS_PER_FOLDER);
  });
});
