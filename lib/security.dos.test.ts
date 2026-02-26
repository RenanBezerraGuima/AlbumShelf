import { describe, it, expect } from 'vitest';
import { sanitizeFolderTree, MAX_TOTAL_FOLDERS, MAX_TOTAL_ALBUMS } from './security';
import type { Folder } from './types';

describe('Security DoS Protection', () => {
  it('should enforce MAX_TOTAL_FOLDERS across root folders', () => {
    // Create 30 root folders, each with 100 subfolders = 3000 folders total (exceeds 2000)
    const rootFolders = Array.from({ length: 30 }, (_, i) => ({
      id: `root-${i}`,
      name: `Root ${i}`,
      subfolders: Array.from({ length: 100 }, (_, j) => ({
        id: `sub-${i}-${j}`,
        name: `Sub ${i}-${j}`
      }))
    }));

    const sanitized = sanitizeFolderTree(rootFolders);

    // Let's verify the actual number of folders created in the sanitized structure
    let count = 0;
    const countFolders = (folders: Folder[]) => {
      count += folders.length;
      folders.forEach(f => countFolders(f.subfolders));
    };
    countFolders(sanitized);

    expect(count).toBeLessThanOrEqual(MAX_TOTAL_FOLDERS);
  });

  it('should enforce MAX_TOTAL_ALBUMS across root folders', () => {
    // Create 2 root folders, each with 6000 albums = 12000 total (exceeds 10000)
    const rootFolders = Array.from({ length: 2 }, (_, i) => ({
      id: `root-${i}`,
      name: `Root ${i}`,
      albums: Array.from({ length: 6000 }, (_, j) => ({
        id: `album-${i}-${j}`,
        name: `Album ${i}-${j}`
      }))
    }));

    const sanitized = sanitizeFolderTree(rootFolders);

    let albumCount = 0;
    const countAlbums = (folders: Folder[]) => {
      folders.forEach(f => {
        albumCount += f.albums.length;
        countAlbums(f.subfolders);
      });
    };
    countAlbums(sanitized);

    expect(albumCount).toBeLessThanOrEqual(MAX_TOTAL_ALBUMS);
  });
});
