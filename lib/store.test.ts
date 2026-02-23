import { describe, it, expect, beforeEach } from 'vitest';
import { useFolderStore, getBreadcrumb } from './store';

describe('useFolderStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    // Since it's a singleton, we need a way to reset it or just clear folders
    const { folders, deleteFolder } = useFolderStore.getState();
    folders.forEach(f => deleteFolder(f.id));
    useFolderStore.setState({ folders: [], selectedFolderId: null });
  });

  it('should add an album to a folder', () => {
    const { createFolder, addAlbumToFolder } = useFolderStore.getState();
    createFolder('Test Folder', null);
    const folder = useFolderStore.getState().folders[0];

    const album = {
      id: 'itunes-1',
      name: 'Album 1',
      artist: 'Artist 1',
      imageUrl: 'url1',
      releaseDate: '2021',
      totalTracks: 10,
    };

    addAlbumToFolder(folder.id, album);

    const updatedFolder = useFolderStore.getState().folders[0];
    expect(updatedFolder.albums).toHaveLength(1);
    expect(updatedFolder.albums[0].name).toBe('Album 1');
    expect(updatedFolder.albums[0].position).toEqual({ x: 0, y: 0 });
  });

  it('Given a folder, when toggling view mode, then the folder view mode is updated', () => {
    const { createFolder, setFolderViewMode } = useFolderStore.getState();
    createFolder('Test Folder', null);
    const folderId = useFolderStore.getState().folders[0].id;

    setFolderViewMode(folderId, 'canvas');

    expect(useFolderStore.getState().folders[0].viewMode).toBe('canvas');
  });

  it('Given an album in a folder, when setting position, then its spatial coordinates are updated', () => {
    const { createFolder, addAlbumToFolder, setAlbumPosition } = useFolderStore.getState();

    createFolder('Spatial Folder', null);
    const folderId = useFolderStore.getState().folders[0].id;

    addAlbumToFolder(folderId, {
      id: 'album-spatial-1',
      name: 'Spatial Album',
      artist: 'Spatial Artist',
      imageUrl: 'url',
      totalTracks: 8,
    });

    setAlbumPosition(folderId, 'album-spatial-1', 920, 460);

    const updatedAlbum = useFolderStore.getState().folders[0].albums[0];
    expect(updatedAlbum.position).toEqual({ x: 920, y: 460 });
  });

  it('should NOT allow adding two different iTunes albums to the same folder if they have undefined spotifyId (the bug)', () => {
    const { createFolder, addAlbumToFolder } = useFolderStore.getState();
    createFolder('Test Folder', null);
    const folder = useFolderStore.getState().folders[0];

    const album1 = {
      id: 'itunes-1',
      name: 'Album 1',
      artist: 'Artist 1',
      imageUrl: 'url1',
      releaseDate: '2021',
      totalTracks: 10,
      // spotifyId is undefined
    };

    const album2 = {
      id: 'itunes-2',
      name: 'Album 2',
      artist: 'Artist 2',
      imageUrl: 'url2',
      releaseDate: '2022',
      totalTracks: 12,
      // spotifyId is undefined
    };

    addAlbumToFolder(folder.id, album1);
    addAlbumToFolder(folder.id, album2);

    const updatedFolder = useFolderStore.getState().folders[0];

    // This is expected to FAIL with current implementation because
    // it checks spotifyId === spotifyId (undefined === undefined)
    expect(updatedFolder.albums).toHaveLength(2);
  });

  it('should move an album from one folder to another', () => {
    const { createFolder, addAlbumToFolder, moveAlbum } = useFolderStore.getState();

    createFolder('Folder 1', null);
    createFolder('Folder 2', null);

    const state = useFolderStore.getState();
    const folder1 = state.folders.find(f => f.name === 'Folder 1')!;
    const folder2 = state.folders.find(f => f.name === 'Folder 2')!;

    const album = {
      id: 'album-1',
      name: 'Album 1',
      artist: 'Artist 1',
      imageUrl: 'url1',
      releaseDate: '2021',
      totalTracks: 10,
    };

    addAlbumToFolder(folder1.id, album);

    expect(useFolderStore.getState().folders.find(f => f.id === folder1.id)!.albums).toHaveLength(1);
    expect(useFolderStore.getState().folders.find(f => f.id === folder2.id)!.albums).toHaveLength(0);

    moveAlbum(folder1.id, folder2.id, album.id);

    const newState = useFolderStore.getState();
    expect(newState.folders.find(f => f.id === folder1.id)!.albums).toHaveLength(0);
    expect(newState.folders.find(f => f.id === folder2.id)!.albums).toHaveLength(1);
    expect(newState.folders.find(f => f.id === folder2.id)!.albums[0].id).toBe('album-1');
  });

  it('should import folders and handle collisions with OLD/NEW naming', () => {
    const { createFolder, importFolders } = useFolderStore.getState();

    // Setup existing state
    createFolder('Rock', null);
    createFolder('Jazz', null);

    const existingFolders = useFolderStore.getState().folders;
    expect(existingFolders).toHaveLength(2);

    // Prepare imported data
    const importedData = [
      {
        id: 'old-id-1',
        name: 'Rock',
        parentId: null,
        albums: [],
        subfolders: [
          {
            id: 'old-id-2',
            name: 'Alternative',
            parentId: 'old-id-1',
            albums: [],
            subfolders: [],
            isExpanded: true
          }
        ],
        isExpanded: true
      },
      {
        id: 'old-id-3',
        name: 'Classical',
        parentId: null,
        albums: [],
        subfolders: [],
        isExpanded: true
      }
    ];

    importFolders(importedData as any);

    const finalFolders = useFolderStore.getState().folders;

    // Total should be 2 existing + 2 imported = 4 root folders
    expect(finalFolders).toHaveLength(4);

    const names = finalFolders.map(f => f.name);
    expect(names).toContain('Rock (OLD)');
    expect(names).toContain('Rock (NEW)');
    expect(names).toContain('Jazz');
    expect(names).toContain('Classical');

    // Verify subfolder of imported Rock (NEW)
    const rockNew = finalFolders.find(f => f.name === 'Rock (NEW)')!;
    expect(rockNew.subfolders).toHaveLength(1);
    expect(rockNew.subfolders[0].name).toBe('Alternative');
    // Verify ID was regenerated
    expect(rockNew.id).not.toBe('old-id-1');
    expect(rockNew.subfolders[0].id).not.toBe('old-id-2');
    expect(rockNew.subfolders[0].parentId).toBe(rockNew.id);
  });

  it('should update lastUpdated on all data-modifying actions', async () => {
    const { createFolder, renameFolder, addAlbumToFolder, setTheme } = useFolderStore.getState();

    const initialLastUpdated = useFolderStore.getState().lastUpdated;

    await new Promise(r => setTimeout(r, 2));
    createFolder('Folder', null);
    expect(useFolderStore.getState().lastUpdated).toBeGreaterThan(initialLastUpdated);

    let currentLastUpdated = useFolderStore.getState().lastUpdated;
    const folderId = useFolderStore.getState().folders[0].id;

    await new Promise(r => setTimeout(r, 2));
    renameFolder(folderId, 'New Name');
    expect(useFolderStore.getState().lastUpdated).toBeGreaterThan(currentLastUpdated);

    currentLastUpdated = useFolderStore.getState().lastUpdated;
    await new Promise(r => setTimeout(r, 2));
    addAlbumToFolder(folderId, { id: 'a1', name: 'A1', artist: 'Art' } as any);
    expect(useFolderStore.getState().lastUpdated).toBeGreaterThan(currentLastUpdated);

    currentLastUpdated = useFolderStore.getState().lastUpdated;
    await new Promise(r => setTimeout(r, 2));
    setTheme('organic');
    expect(useFolderStore.getState().lastUpdated).toBeGreaterThan(currentLastUpdated);
  });

  it('should NOT update lastUpdated when setting identical values (bail out)', async () => {
    const { setTheme, setSelectedFolder, setStreamingProvider } = useFolderStore.getState();

    // Initial set
    setTheme('mint');
    setSelectedFolder('f1');
    setStreamingProvider('apple');
    const initialLastUpdated = useFolderStore.getState().lastUpdated;

    // Set identical values
    await new Promise(r => setTimeout(r, 2));
    setTheme('mint');
    setSelectedFolder('f1');
    setStreamingProvider('apple');

    expect(useFolderStore.getState().lastUpdated).toBe(initialLastUpdated);

    // Set different value
    await new Promise(r => setTimeout(r, 2));
    setTheme('industrial');
    expect(useFolderStore.getState().lastUpdated).toBeGreaterThan(initialLastUpdated);
  });

  it('should NOT update lastUpdated or folders reference when renaming to same name', async () => {
    const { createFolder, renameFolder } = useFolderStore.getState();
    createFolder('Root', null);
    const folderId = useFolderStore.getState().folders[0].id;
    const initialFolders = useFolderStore.getState().folders;
    const initialLastUpdated = useFolderStore.getState().lastUpdated;

    await new Promise(r => setTimeout(r, 2));
    renameFolder(folderId, 'Root');

    expect(useFolderStore.getState().folders).toBe(initialFolders);
    expect(useFolderStore.getState().lastUpdated).toBe(initialLastUpdated);

    await new Promise(r => setTimeout(r, 2));
    renameFolder(folderId, 'New Name');
    expect(useFolderStore.getState().folders).not.toBe(initialFolders);
    expect(useFolderStore.getState().lastUpdated).toBeGreaterThan(initialLastUpdated);
  });

  it('should truncate spotifyToken to 1024 characters', () => {
    const { setSpotifyToken } = useFolderStore.getState();
    const longToken = 'A'.repeat(2000);
    setSpotifyToken(longToken, 3600, Date.now());
    expect(useFolderStore.getState().spotifyToken?.length).toBe(1024);
  });

  it('should return breadcrumb path with ids and names', () => {
    const { createFolder } = useFolderStore.getState();

    createFolder('Root', null);
    const rootId = useFolderStore.getState().folders[0].id;

    createFolder('Child', rootId);
    const childId = useFolderStore.getState().folders[0].subfolders[0].id;

    createFolder('Grandchild', childId);
    const grandchildId = useFolderStore.getState().folders[0].subfolders[0].subfolders[0].id;

    const breadcrumb = getBreadcrumb(useFolderStore.getState().folders, grandchildId);

    expect(breadcrumb).toHaveLength(3);
    expect(breadcrumb[0]).toEqual({ id: rootId, name: 'Root' });
    expect(breadcrumb[1]).toEqual({ id: childId, name: 'Child' });
    expect(breadcrumb[2]).toEqual({ id: grandchildId, name: 'Grandchild' });
  });

  it('should validate state during rehydration', () => {
    const persistOptions = useFolderStore.persist.getOptions();
    const onRehydrateStorage = persistOptions.onRehydrateStorage;
    if (onRehydrateStorage) {
      const handler = onRehydrateStorage(useFolderStore.getState());
      if (handler) {
        const maliciousState: any = {
          theme: 'malicious',
          streamingProvider: 'malicious',
          spotifyToken: 'A'.repeat(2000),
          lastUpdated: 'invalid'
        };
        handler(maliciousState, undefined);
        expect(maliciousState.theme).toBe('industrial');
        expect(maliciousState.streamingProvider).toBe('deezer');
        expect(maliciousState.spotifyToken.length).toBe(1024);
        expect(typeof maliciousState.lastUpdated).toBe('number');
      }
    }
  });
});
