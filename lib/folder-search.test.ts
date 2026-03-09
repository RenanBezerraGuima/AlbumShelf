import { describe, expect, it } from 'vitest';
import { getFolderSearchState } from './folder-search';
import type { Folder } from './types';

const folders: Folder[] = [
  {
    id: 'root-rock',
    name: 'Rock Classics',
    parentId: null,
    albums: [
      { id: 'a1', name: 'Led Zeppelin IV', artist: 'Led Zeppelin', imageUrl: 'https://example.com/a1.jpg', totalTracks: 8 },
      { id: 'a2', name: 'Paranoid', artist: 'Black Sabbath', imageUrl: 'https://example.com/a2.jpg', totalTracks: 8 },
    ],
    subfolders: [],
    isExpanded: false,
    viewMode: 'grid',
  },
  {
    id: 'root-jazz',
    name: 'Jazz Essentials',
    parentId: null,
    albums: [{ id: 'a3', name: 'Kind of Blue', artist: 'Miles Davis', imageUrl: 'https://example.com/a3.jpg', totalTracks: 5 }],
    subfolders: [
      {
        id: 'child-fusion',
        name: 'Fusion',
        parentId: 'root-jazz',
        albums: [{ id: 'a4', name: 'Bitches Brew', artist: 'Miles Davis', imageUrl: 'https://example.com/a4.jpg', totalTracks: 6 }],
        subfolders: [],
        isExpanded: false,
        viewMode: 'grid',
      },
    ],
    isExpanded: false,
    viewMode: 'grid',
  },
];

describe('getFolderSearchState', () => {
  it('returns empty sets when the query is empty', () => {
    const result = getFolderSearchState(folders, '');

    expect(result.hasQuery).toBe(false);
    // Contract: UI components handle showing all folders when hasQuery is false
    // to avoid O(N) work to populate the set.
    expect(result.visibleFolderIds.size).toBe(0);
    expect(result.forcedExpandedFolderIds.size).toBe(0);
  });

  it('keeps matching ancestors visible and forced open', () => {
    const result = getFolderSearchState(folders, 'Miles Davis');

    expect(Array.from(result.visibleFolderIds).sort()).toEqual([
      'child-fusion',
      'root-jazz',
    ]);
    expect(Array.from(result.forcedExpandedFolderIds)).toEqual(['root-jazz']);
  });

  it('matches folder names and album names case-insensitively', () => {
    const byFolderName = getFolderSearchState(folders, 'rock');
    const byAlbumName = getFolderSearchState(folders, 'paranoid');

    expect(Array.from(byFolderName.visibleFolderIds)).toEqual(['root-rock']);
    expect(Array.from(byAlbumName.visibleFolderIds)).toEqual(['root-rock']);
  });

  it('does not match across different albums due to separator', () => {
    // If the albums were "Kind of Blue" and "Bitches Brew", a query like "Blue Bitches"
    // should not match unless it's in a single album.
    const result = getFolderSearchState(folders, 'Blue Bitches');
    expect(result.visibleFolderIds.size).toBe(0);
  });
});
