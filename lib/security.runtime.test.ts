import { describe, it, expect, beforeEach } from 'vitest';
import { useFolderStore } from './store';
import { MAX_FOLDER_DEPTH, MAX_TOTAL_FOLDERS, MAX_TOTAL_ALBUMS } from './security';

describe('Security: Store Runtime Limits', () => {
  beforeEach(() => {
    useFolderStore.setState({ folders: [], selectedFolderId: null });
  });

  it('should prevent creating folders beyond MAX_FOLDER_DEPTH', () => {
    const { createFolder, toggleFolderExpanded } = useFolderStore.getState();

    // Create a chain of 50 folders
    let lastId: string | null = null;
    for (let i = 0; i < MAX_FOLDER_DEPTH; i++) {
      createFolder(`Folder ${i}`, lastId);
      const folders = useFolderStore.getState().folders;
      // This is a bit slow because we have to find the last created folder's ID
      // but it's okay for a test.
      const findLast = (f: any[]): string => {
        if (f[f.length - 1].subfolders.length === 0) return f[f.length - 1].id;
        return findLast(f[f.length - 1].subfolders);
      };
      lastId = findLast(folders);
    }

    // Try to create the 51st folder
    createFolder('Too Deep', lastId);

    const findDepth = (f: any[], d = 0): number => {
      if (f.length === 0) return d;
      return Math.max(...f.map(folder => findDepth(folder.subfolders, d + 1)));
    };

    const depth = findDepth(useFolderStore.getState().folders);
    expect(depth).toBeLessThanOrEqual(MAX_FOLDER_DEPTH);
  });

  it('should prevent moving folders beyond MAX_FOLDER_DEPTH', () => {
    const { createFolder, moveFolder } = useFolderStore.getState();

    // Create two chains of 26 folders
    // Chain A: 0 -> 1 -> ... -> 25 (depth 26)
    // Chain B: 100 -> 101 -> ... -> 125 (depth 26)
    // Moving Chain B into Chain A's leaf would result in depth 52.

    let lastIdA: string | null = null;
    for (let i = 0; i < 26; i++) {
        createFolder(`A${i}`, lastIdA);
        const folders = useFolderStore.getState().folders;
        const findLast = (f: any[]): string => {
            if (f[f.length - 1].subfolders.length === 0) return f[f.length - 1].id;
            return findLast(f[f.length - 1].subfolders);
        };
        lastIdA = findLast(folders);
    }

    let lastIdB: string | null = null;
    let rootIdB: string | null = null;
    for (let i = 0; i < 26; i++) {
        createFolder(`B${i}`, lastIdB);
        const folders = useFolderStore.getState().folders;
        const findLast = (f: any[]): string => {
            const rootB = f.find(folder => folder.name === 'B0');
            let current = rootB;
            while(current.subfolders.length > 0) current = current.subfolders[0];
            return current.id;
        };
        lastIdB = findLast(folders);
        if (i === 0) rootIdB = folders.find(f => f.name === 'B0').id;
    }

    // Attempt to move rootIdB into lastIdA
    moveFolder(rootIdB!, lastIdA, null);

    const findDepth = (f: any[], d = 0): number => {
        if (f.length === 0) return d;
        return Math.max(...f.map(folder => findDepth(folder.subfolders, d + 1)));
    };

    const depth = findDepth(useFolderStore.getState().folders);
    expect(depth).toBeLessThanOrEqual(MAX_FOLDER_DEPTH);
  });

  it('should prevent adding folders beyond MAX_TOTAL_FOLDERS', () => {
    const { createFolder } = useFolderStore.getState();

    // Fill up to the limit
    for (let i = 0; i < MAX_TOTAL_FOLDERS; i++) {
        createFolder(`Folder ${i}`, null);
    }

    expect(useFolderStore.getState().folders.length).toBe(MAX_TOTAL_FOLDERS);

    // Try one more
    createFolder('One Too Many', null);
    expect(useFolderStore.getState().folders.length).toBe(MAX_TOTAL_FOLDERS);
  });

  it('should prevent adding albums beyond MAX_TOTAL_ALBUMS', () => {
    const { createFolder, addAlbumToFolder } = useFolderStore.getState();
    createFolder('Folder', null);
    const folderId = useFolderStore.getState().folders[0].id;

    // We can't easily add 10000 albums in a loop for a test without it being slow
    // So let's mock the state to be near the limit
    const manyAlbums = Array.from({ length: MAX_TOTAL_ALBUMS }, (_, i) => ({ id: `a${i}`, name: `A${i}`, artist: 'Artist', imageUrl: '', totalTracks: 0 }));
    useFolderStore.setState({
        folders: [{
            id: folderId,
            name: 'Folder',
            parentId: null,
            albums: manyAlbums,
            subfolders: [],
            isExpanded: true
        }]
    });

    addAlbumToFolder(folderId, { id: 'too-many', name: 'Too Many', artist: 'Artist', imageUrl: '', totalTracks: 0 });

    expect(useFolderStore.getState().folders[0].albums.length).toBe(MAX_TOTAL_ALBUMS);
  });
});
