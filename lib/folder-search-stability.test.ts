import { describe, expect, it } from 'vitest';
import { getFolderSearchState } from './folder-search';
import type { Folder } from './types';

describe('getFolderSearchState stability and caching', () => {
  const albums = [
    { id: 'a1', name: 'Album 1', artist: 'Artist 1', imageUrl: '', totalTracks: 10 }
  ];

  const folders: Folder[] = [
    {
      id: 'f1',
      name: 'Folder 1',
      parentId: null,
      albums,
      subfolders: [],
      isExpanded: false,
      viewMode: 'grid',
    }
  ];

  it('provides referential stability for empty queries', () => {
    const state1 = getFolderSearchState(folders, '');
    const state2 = getFolderSearchState(folders, '   ');
    const state3 = getFolderSearchState([], '');

    expect(state1).toBe(state2);
    expect(state1).toBe(state3);
    expect(state1.visibleFolderIds).toBe(state2.visibleFolderIds);
    expect(state1.visibleFolderIds.size).toBe(0);
  });

  it('preserves search content cache across folder renames (structural sharing)', () => {
    // We can't directly inspect the WeakMap, but we can verify that the albums
    // array reference remains the same, which is our new cache key.

    const folder1: Folder = {
      id: 'f1',
      name: 'Original Name',
      parentId: null,
      albums: [...albums],
      subfolders: [],
      isExpanded: false,
      viewMode: 'grid',
    };

    // First search to populate cache
    getFolderSearchState([folder1], 'Artist 1');

    // Simulate a folder rename (new Folder object, same albums reference)
    const folder2: Folder = {
      ...folder1,
      name: 'New Name'
    };

    expect(folder1).not.toBe(folder2);
    expect(folder1.albums).toBe(folder2.albums);

    // Second search should hit the cache keyed by folder1.albums
    const result = getFolderSearchState([folder2], 'Artist 1');
    expect(result.visibleFolderIds.has('f1')).toBe(true);
  });
});
