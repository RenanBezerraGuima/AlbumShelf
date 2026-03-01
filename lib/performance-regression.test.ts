import { describe, expect, it } from 'vitest';
import { compressData, decompressData } from './share-service';
import { findFolder, getBreadcrumb } from './store';
import type { Folder } from './types';

function makeTree(depth: number, breadth: number, prefix = 'root'): Folder[] {
  if (depth <= 0) return [];

  const nodes: Folder[] = [];
  for (let i = 0; i < breadth; i++) {
    const id = `${prefix}-${depth}-${i}`;
    nodes.push({
      id,
      name: `Folder ${id}`,
      parentId: null,
      albums: [],
      subfolders: makeTree(depth - 1, breadth, id).map((f) => ({
        ...f,
        parentId: id,
      })),
      isExpanded: true,
      viewMode: 'grid',
    });
  }
  return nodes;
}

describe('performance regression checks', () => {
  it('findFolder/getBreadcrumb stay within stable runtime budget on large trees', () => {
    const folders = makeTree(4, 6); // 1,554 folders
    const targetId =
      folders[0].subfolders[2].subfolders[2].subfolders[2].id;

    const start = performance.now();
    for (let i = 0; i < 1_000; i++) {
      findFolder(folders, targetId);
      getBreadcrumb(folders, targetId);
    }
    const durationMs = performance.now() - start;

    // Conservative budget for GitHub Actions shared runners.
    expect(durationMs).toBeLessThan(700);
  });

  it('share payload compression/decompression remains bounded for large datasets', () => {
    const folders = makeTree(3, 8).map((folder, idx) => ({
      ...folder,
      albums: Array.from({ length: 20 }, (_, albumIdx) => ({
        id: `spotify-${idx}-${albumIdx}`,
        spotifyId: `${idx}-${albumIdx}`,
        name: `Album ${idx}-${albumIdx}`,
        artist: 'Artist',
        imageUrl: 'https://example.com/cover.jpg',
        totalTracks: 10,
        externalUrl: 'https://open.spotify.com',
      })),
    }));

    const compressStart = performance.now();
    const compressed = compressData(folders, 'spotify');
    const compressDurationMs = performance.now() - compressStart;

    const decompressStart = performance.now();
    const decompressed = decompressData(compressed);
    const decompressDurationMs = performance.now() - decompressStart;

    expect(compressed.length).toBeGreaterThan(0);
    expect(decompressed?.folders.length).toBeGreaterThan(0);
    expect(compressDurationMs).toBeLessThan(800);
    expect(decompressDurationMs).toBeLessThan(800);
  });
});
