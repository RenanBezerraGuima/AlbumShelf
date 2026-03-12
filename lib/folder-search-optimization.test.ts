import { describe, it, expect } from 'vitest';
import { getFolderSearchState } from './folder-search';
import type { Folder } from './types';

describe('FolderSearch Optimization', () => {
  it('returns stable EMPTY_SET references when query is empty', () => {
    const folders1: Folder[] = [
      {
        id: '1',
        name: 'Folder 1',
        parentId: null,
        albums: [],
        subfolders: [],
        isExpanded: true,
      },
    ];

    const folders2: Folder[] = [
      {
        ...folders1[0],
        name: 'Updated Folder 1',
      },
    ];

    const state1 = getFolderSearchState(folders1, '');
    const state2 = getFolderSearchState(folders2, '');

    expect(state1.visibleFolderIds).toBe(state2.visibleFolderIds);
    expect(state1.forcedExpandedFolderIds).toBe(state2.forcedExpandedFolderIds);
    expect(state1.hasQuery).toBe(false);
  });

  it('still performs search correctly when query is provided', () => {
    const folders: Folder[] = [
      {
        id: '1',
        name: 'Rock',
        parentId: null,
        albums: [
          {
            id: 'a1',
            name: 'The Wall',
            artist: 'Pink Floyd',
            imageUrl: '',
            totalTracks: 26,
          },
        ],
        subfolders: [],
        isExpanded: true,
      },
      {
        id: '2',
        name: 'Jazz',
        parentId: null,
        albums: [],
        subfolders: [],
        isExpanded: true,
      },
    ];

    const state = getFolderSearchState(folders, 'Wall');
    expect(state.hasQuery).toBe(true);
    expect(state.visibleFolderIds.has('1')).toBe(true);
    expect(state.visibleFolderIds.has('2')).toBe(false);
  });
});
