import { describe, it, expect } from 'vitest';
import { sanitizeText, getTreeDepth, sanitizeFolder } from './security';
import type { Folder } from './types';

function makeLargeTree(depth: number, breadth: number): Folder {
  const folder: any = {
    id: `folder-${depth}-${breadth}`,
    name: 'Test Folder ' + 'A'.repeat(50),
    albums: Array.from({ length: 50 }, (_, i) => ({
      id: `album-${i}`,
      name: 'Album ' + i + ' ' + 'B'.repeat(50),
      artist: 'Artist ' + i + ' ' + 'C'.repeat(50),
      imageUrl: 'https://example.com/image.jpg',
      totalTracks: 10,
    })),
    subfolders: depth > 0 ? Array.from({ length: breadth }, () => makeLargeTree(depth - 1, breadth)) : [],
    isExpanded: true,
    viewMode: 'grid',
  };
  return folder as Folder;
}

describe('security.ts micro-benchmarks', () => {
  it('measures sanitizeText performance', () => {
    const longString = 'Some text with control chars \x01\x02 and bidi chars \u202A\u202B ' + 'D'.repeat(1000);
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      sanitizeText(longString);
    }
    const duration = performance.now() - start;
    console.log(`sanitizeText (10k iterations): ${duration.toFixed(2)}ms`);
  });

  it('measures getTreeDepth performance', () => {
    const tree = makeLargeTree(5, 3); // 364 folders
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      getTreeDepth(tree);
    }
    const duration = performance.now() - start;
    console.log(`getTreeDepth (1k iterations): ${duration.toFixed(2)}ms`);
  });

  it('measures sanitizeFolder performance', () => {
    const rawFolder = makeLargeTree(3, 4); // 85 folders
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      sanitizeFolder(rawFolder);
    }
    const duration = performance.now() - start;
    console.log(`sanitizeFolder (100 iterations): ${duration.toFixed(2)}ms`);
  });

  it('measures idempotent sanitizeFolder performance and reference stability', () => {
    const rawFolder = makeLargeTree(3, 4);
    const sanitizedOnce = sanitizeFolder(rawFolder);

    // Warm up
    sanitizeFolder(sanitizedOnce);

    const start = performance.now();
    const iterations = 100;
    for (let i = 0; i < iterations; i++) {
      sanitizeFolder(sanitizedOnce);
    }
    const duration = performance.now() - start;
    console.log(`Idempotent sanitizeFolder (100 iterations): ${duration.toFixed(2)}ms`);

    const sanitizedTwice = sanitizeFolder(sanitizedOnce);
    expect(sanitizedTwice).toBe(sanitizedOnce);
    console.log('Reference stability: PASSED');
  });
});
