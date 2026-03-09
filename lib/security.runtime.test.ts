import { describe, it, expect, beforeEach } from 'vitest';
import { useFolderStore } from './store';
import {
  MAX_TOTAL_ALBUMS,
  MAX_TOTAL_FOLDERS,
  MAX_FOLDER_DEPTH,
  MAX_ALBUMS_PER_FOLDER,
  MAX_SUBFOLDERS_PER_FOLDER
} from './security';

describe('Security Runtime Limits', () => {
  beforeEach(() => {
    useFolderStore.setState({
      folders: [],
      sharedFolders: null,
      selectedFolderId: null,
      lastUpdated: 0
    });
  });

  it('should enforce MAX_TOTAL_FOLDERS in createFolder', () => {
    const { createFolder } = useFolderStore.getState();

    // Create a very large number of folders by setting state directly to save time
    const manyFolders = Array.from({ length: MAX_TOTAL_FOLDERS }, (_, i) => ({
      id: `f-${i}`,
      name: `Folder ${i}`,
      parentId: null,
      albums: [],
      subfolders: [],
      isExpanded: false,
      viewMode: 'grid' as const
    }));

    useFolderStore.setState({ folders: manyFolders });

    // Attempt to create one more folder
    createFolder('Overflow Folder', null);

    expect(useFolderStore.getState().folders).toHaveLength(MAX_TOTAL_FOLDERS);
    expect(useFolderStore.getState().folders.find(f => f.name === 'Overflow Folder')).toBeUndefined();
  });

  it('should enforce MAX_SUBFOLDERS_PER_FOLDER in createFolder', () => {
    const { createFolder } = useFolderStore.getState();

    createFolder('Parent', null);
    const parentId = useFolderStore.getState().folders[0].id;

    const manySubfolders = Array.from({ length: MAX_SUBFOLDERS_PER_FOLDER }, (_, i) => ({
      id: `sf-${i}`,
      name: `Subfolder ${i}`,
      parentId: parentId,
      albums: [],
      subfolders: [],
      isExpanded: false,
      viewMode: 'grid' as const
    }));

    useFolderStore.setState({
      folders: [{
        ...useFolderStore.getState().folders[0],
        subfolders: manySubfolders
      }]
    });

    // Attempt to create one more subfolder
    createFolder('Overflow Subfolder', parentId);

    const parent = useFolderStore.getState().folders[0];
    expect(parent.subfolders).toHaveLength(MAX_SUBFOLDERS_PER_FOLDER);
    expect(parent.subfolders.find(f => f.name === 'Overflow Subfolder')).toBeUndefined();
  });

  it('should enforce MAX_FOLDER_DEPTH in createFolder', () => {
    const { createFolder } = useFolderStore.getState();

    // Create a tree at max depth
    let currentFolders: any[] = [];
    let lastId: string | null = null;

    for (let i = 0; i < MAX_FOLDER_DEPTH; i++) {
      const id = `depth-${i}`;
      const newFolder = {
        id,
        name: `Depth ${i}`,
        parentId: lastId,
        albums: [],
        subfolders: [],
        isExpanded: true,
        viewMode: 'grid' as const
      };

      if (lastId === null) {
        currentFolders = [newFolder];
      } else {
        // This is a bit complex to build manually for a deep tree,
        // let's just mock the depth by setting parentId and relying on getFolderDepth (which uses getBreadcrumb)
        // But getBreadcrumb needs the full tree index.
      }
      lastId = id;
    }

    // A simpler way: mock the store to have a deep folder
    const buildDeepTree = (depth: number, parentId: string | null = null): any[] => {
      if (depth === 0) return [];
      const id = `d-${depth}`;
      return [{
        id,
        name: `Depth ${depth}`,
        parentId,
        albums: [],
        isExpanded: true,
        viewMode: 'grid' as const,
        subfolders: buildDeepTree(depth - 1, id)
      }];
    };

    const deepTree = buildDeepTree(MAX_FOLDER_DEPTH);
    useFolderStore.setState({ folders: deepTree });

    // Find the deepest folder ID
    const findDeepestId = (folders: any[]): string => {
      if (folders[0].subfolders.length === 0) return folders[0].id;
      return findDeepestId(folders[0].subfolders);
    };
    const deepestId = findDeepestId(deepTree);

    // Attempt to create a folder inside the deepest one
    createFolder('Too Deep', deepestId);

    const updatedTree = useFolderStore.getState().folders;
    const deepestFolder = ((): any => {
      let curr = updatedTree[0];
      while (curr.subfolders.length > 0) curr = curr.subfolders[0];
      return curr;
    })();

    expect(deepestFolder.id).toBe(deepestId);
    expect(deepestFolder.subfolders).toHaveLength(0);
  });

  it('should enforce MAX_TOTAL_ALBUMS in addAlbumToFolder', () => {
    const { createFolder, addAlbumToFolder } = useFolderStore.getState();

    createFolder('Target', null);
    const folderId = useFolderStore.getState().folders[0].id;

    // Pre-fill with max albums
    const manyAlbums = Array.from({ length: MAX_TOTAL_ALBUMS }, (_, i) => ({
      id: `a-${i}`,
      name: `Album ${i}`,
      artist: 'Artist',
      imageUrl: 'url',
      totalTracks: 1
    }));

    useFolderStore.setState({
      folders: [{
        ...useFolderStore.getState().folders[0],
        albums: manyAlbums
      }]
    });

    // Attempt to add one more album
    addAlbumToFolder(folderId, { id: 'overflow', name: 'Overflow', artist: 'Artist', imageUrl: 'url', totalTracks: 1 });

    expect(useFolderStore.getState().folders[0].albums).toHaveLength(MAX_TOTAL_ALBUMS);
    expect(useFolderStore.getState().folders[0].albums.find(a => a.id === 'overflow')).toBeUndefined();
  });

  it('should enforce MAX_ALBUMS_PER_FOLDER in addAlbumToFolder', () => {
    const { createFolder, addAlbumToFolder } = useFolderStore.getState();

    createFolder('Target', null);
    const folderId = useFolderStore.getState().folders[0].id;

    // Pre-fill folder with max albums
    const manyAlbums = Array.from({ length: MAX_ALBUMS_PER_FOLDER }, (_, i) => ({
      id: `a-${i}`,
      name: `Album ${i}`,
      artist: 'Artist',
      imageUrl: 'url',
      totalTracks: 1
    }));

    useFolderStore.setState({
      folders: [{
        ...useFolderStore.getState().folders[0],
        albums: manyAlbums
      }]
    });

    // Attempt to add one more album
    addAlbumToFolder(folderId, { id: 'overflow', name: 'Overflow', artist: 'Artist', imageUrl: 'url', totalTracks: 1 });

    expect(useFolderStore.getState().folders[0].albums).toHaveLength(MAX_ALBUMS_PER_FOLDER);
  });

  it('should prevent moving folder if it would exceed MAX_FOLDER_DEPTH', () => {
    const { createFolder, moveFolder } = useFolderStore.getState();

    // Create a tree of depth 30
    const buildTree = (depth: number, prefix: string, parentId: string | null = null): any[] => {
      if (depth === 0) return [];
      const id = `${prefix}-${depth}`;
      return [{
        id,
        name: `Folder ${prefix} ${depth}`,
        parentId,
        albums: [],
        isExpanded: true,
        viewMode: 'grid' as const,
        subfolders: buildTree(depth - 1, prefix, id)
      }];
    };

    // Root A (depth 30)
    // Root B (depth 25)
    // 30 + 25 = 55 (exceeds 50)
    const treeA = buildTree(30, 'A');
    const treeB = buildTree(25, 'B');

    useFolderStore.setState({ folders: [...treeA, ...treeB] });

    const folderAId = treeA[0].id;
    const findDeepestId = (folders: any[]): string => {
      if (folders[0].subfolders.length === 0) return folders[0].id;
      return findDeepestId(folders[0].subfolders);
    };
    const deepestBId = findDeepestId(treeB);

    // Attempt to move Root A into the deepest folder of Root B
    moveFolder(folderAId, deepestBId, null);

    const state = useFolderStore.getState();
    expect(state.folders.find(f => f.id === folderAId)!.parentId).toBeNull();
  });

  it('should enforce global limits during importFolders', () => {
    const { importFolders } = useFolderStore.getState();

    // Pre-fill state to near limit
    const existingFolders = Array.from({ length: MAX_TOTAL_FOLDERS - 5 }, (_, i) => ({
      id: `existing-${i}`,
      name: `Existing ${i}`,
      parentId: null,
      albums: [],
      subfolders: [],
      isExpanded: false,
      viewMode: 'grid' as const
    }));

    useFolderStore.setState({ folders: existingFolders });

    // Import 10 new folders
    const importedFolders = Array.from({ length: 10 }, (_, i) => ({
      id: `imported-${i}`,
      name: `Imported ${i}`,
      parentId: null,
      albums: [],
      subfolders: [],
      isExpanded: false,
      viewMode: 'grid' as const
    }));

    importFolders(importedFolders);

    // Should only have imported 5 folders to reach limit
    expect(useFolderStore.getState().folders).toHaveLength(MAX_TOTAL_FOLDERS);
  });

  it('should reject non-finite coordinates in setAlbumPosition', () => {
    const { createFolder, addAlbumToFolder, setAlbumPosition } = useFolderStore.getState();

    createFolder('Folder', null);
    const folderId = useFolderStore.getState().folders[0].id;
    addAlbumToFolder(folderId, { id: 'a1', name: 'A1', artist: 'Art' } as any);

    const initialPos = useFolderStore.getState().folders[0].albums[0].position;

    setAlbumPosition(folderId, 'a1', Infinity, 100);
    expect(useFolderStore.getState().folders[0].albums[0].position).toEqual(initialPos);

    setAlbumPosition(folderId, 'a1', 100, NaN);
    expect(useFolderStore.getState().folders[0].albums[0].position).toEqual(initialPos);

    setAlbumPosition(folderId, 'a1', 200, 300);
    expect(useFolderStore.getState().folders[0].albums[0].position).toEqual({ x: 200, y: 300 });
  });
});
