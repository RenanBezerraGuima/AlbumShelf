import { describe, it, expect } from 'vitest';
import { getFolderDepth, getTreeDepth, countTreeItems } from './security';
import type { Folder } from './types';

describe('Security Tree Utilities', () => {
  const tree: Folder[] = [
    {
      id: '1',
      name: 'Root 1',
      parentId: null,
      albums: [{ id: 'a1' } as any],
      subfolders: [
        {
          id: '1-1',
          name: 'Sub 1-1',
          parentId: '1',
          albums: [{ id: 'a2' } as any],
          subfolders: [
            {
              id: '1-1-1',
              name: 'Sub 1-1-1',
              parentId: '1-1',
              albums: [],
              subfolders: []
            }
          ]
        }
      ]
    },
    {
      id: '2',
      name: 'Root 2',
      parentId: null,
      albums: [],
      subfolders: []
    }
  ];

  it('getFolderDepth should return correct depth', () => {
    expect(getFolderDepth(tree, '1')).toBe(1);
    expect(getFolderDepth(tree, '1-1')).toBe(2);
    expect(getFolderDepth(tree, '1-1-1')).toBe(3);
    expect(getFolderDepth(tree, '2')).toBe(1);
    expect(getFolderDepth(tree, 'non-existent')).toBe(0);
  });

  it('getTreeDepth should return correct max depth for a folder', () => {
    expect(getTreeDepth(tree[0])).toBe(3);
    expect(getTreeDepth(tree[1])).toBe(1);
  });

  it('countTreeItems should count all folders and albums', () => {
    const counts = countTreeItems(tree);
    expect(counts.folders).toBe(4);
    expect(counts.albums).toBe(2);
  });
});
