import { describe, it, expect, beforeEach } from 'vitest';
import { useFolderStore, getBreadcrumb, applySyncState, type SyncState } from './store';

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

  it('moves folders across parents and prevents invalid descendant moves', () => {
    const { createFolder, moveFolder } = useFolderStore.getState();

    createFolder('Root A', null);
    createFolder('Root B', null);
    const rootAId = useFolderStore.getState().folders.find((f) => f.name === 'Root A')!.id;
    const rootBId = useFolderStore.getState().folders.find((f) => f.name === 'Root B')!.id;

    createFolder('Child A1', rootAId);
    const childA1Id = useFolderStore.getState().folders.find((f) => f.id === rootAId)!.subfolders[0].id;

    // Move child from Root A -> Root B
    moveFolder(childA1Id, rootBId, null);
    const rootANow = useFolderStore.getState().folders.find((f) => f.id === rootAId)!;
    const rootBNow = useFolderStore.getState().folders.find((f) => f.id === rootBId)!;
    expect(rootANow.subfolders).toHaveLength(0);
    expect(rootBNow.subfolders.map((f) => f.id)).toContain(childA1Id);

    // Invalid move: parent into its own descendant should be ignored
    moveFolder(rootBId, childA1Id, null);
    const rootBAfterInvalid = useFolderStore.getState().folders.find((f) => f.id === rootBId)!;
    expect(rootBAfterInvalid.parentId).toBe(null);
  });

  it('reorders albums and ignores invalid reorder indices', () => {
    const { createFolder, addAlbumToFolder, reorderAlbum } = useFolderStore.getState();
    createFolder('Playlist', null);
    const folderId = useFolderStore.getState().folders[0].id;

    addAlbumToFolder(folderId, { id: 'a1', name: 'A1', artist: 'X', imageUrl: 'u', totalTracks: 1 });
    addAlbumToFolder(folderId, { id: 'a2', name: 'A2', artist: 'X', imageUrl: 'u', totalTracks: 1 });
    addAlbumToFolder(folderId, { id: 'a3', name: 'A3', artist: 'X', imageUrl: 'u', totalTracks: 1 });

    reorderAlbum(folderId, 0, 2);
    expect(useFolderStore.getState().folders[0].albums.map((a) => a.id)).toEqual(['a2', 'a3', 'a1']);

    const before = useFolderStore.getState().folders[0].albums;
    reorderAlbum(folderId, -1, 0);
    reorderAlbum(folderId, 0, 99);
    expect(useFolderStore.getState().folders[0].albums).toEqual(before);
  });

  it('hydrates shared folders album metadata using album map', () => {
    const { setSharedFolders, hydrateSharedFolders } = useFolderStore.getState();
    setSharedFolders([
      {
        id: 'f1',
        name: 'Shared',
        parentId: null,
        isExpanded: true,
        viewMode: 'grid',
        albums: [
          {
            id: 'spotify-1',
            name: 'Loading...',
            artist: '',
            imageUrl: '',
            totalTracks: 0,
            position: { x: 12, y: 34 },
          },
        ],
        subfolders: [],
      } as any,
    ]);

    const hydratedAlbum = {
      id: 'spotify-1',
      spotifyId: '1',
      name: 'Hydrated Name',
      artist: 'Hydrated Artist',
      imageUrl: 'https://example.com/x.jpg',
      totalTracks: 10,
    } as any;

    hydrateSharedFolders(new Map([['spotify-1', hydratedAlbum]]));
    const shared = useFolderStore.getState().sharedFolders!;
    expect(shared[0].albums[0].name).toBe('Hydrated Name');
    expect(shared[0].albums[0].position).toEqual({ x: 12, y: 34 });
  });

  it('Performance: hydrateSharedFolders implements structural sharing', () => {
    const { setSharedFolders, hydrateSharedFolders } = useFolderStore.getState();
    const initialFolders = [
      {
        id: 'f-root',
        name: 'Root',
        albums: [{ id: 'a-root', name: 'A-root' }],
        subfolders: [
          {
            id: 'f-child-1',
            name: 'Child 1',
            albums: [{ id: 'a-child-1', name: 'A-child-1' }],
            subfolders: [],
          },
          {
            id: 'f-child-2',
            name: 'Child 2',
            albums: [{ id: 'a-child-2', name: 'A-child-2' }],
            subfolders: [],
          }
        ],
      }
    ] as any;

    setSharedFolders(initialFolders);
    const state1 = useFolderStore.getState();
    const folderChild1Before = state1.sharedFolders![0].subfolders[0];
    const folderChild2Before = state1.sharedFolders![0].subfolders[1];
    const rootBefore = state1.sharedFolders![0];

    // Hydrate ONLY an album in Child 1
    const hydratedAlbum = { id: 'a-child-1', name: 'Hydrated' } as any;
    hydrateSharedFolders(new Map([['a-child-1', hydratedAlbum]]));

    const state2 = useFolderStore.getState();
    const rootAfter = state2.sharedFolders![0];
    const folderChild1After = state2.sharedFolders![0].subfolders[0];
    const folderChild2After = state2.sharedFolders![0].subfolders[1];

    // Root and Child 1 should have new references because they or their children changed
    expect(rootAfter).not.toBe(rootBefore);
    expect(folderChild1After).not.toBe(folderChild1Before);
    expect(folderChild1After.albums[0].name).toBe('Hydrated');

    // Child 2 should RETAIN its original reference because nothing changed in it
    expect(folderChild2After).toBe(folderChild2Before);

    // Call hydrate again with an empty map - everything should retain original references
    hydrateSharedFolders(new Map());
    const state3 = useFolderStore.getState();
    expect(state3.sharedFolders).toBe(state2.sharedFolders);
    expect(state3.sharedFolders![0]).toBe(rootAfter);
  });

  it('sets drag state and guest mode flags', () => {
    const {
      setDraggedAlbum,
      setDraggedFolderId,
      setDraggedFolder,
      setIsGuestMode,
      setSharedFolders,
      exitGuestMode,
    } = useFolderStore.getState();

    setDraggedAlbum({ id: 'a1' } as any, 'f1', 3);
    setDraggedFolderId('f2');
    setDraggedFolder({ id: 'f3' } as any, 'root');
    setIsGuestMode(true);
    setSharedFolders([]);
    expect(useFolderStore.getState().draggedFolderId).toBe('f2');
    expect(useFolderStore.getState().draggedFolder?.id).toBe('f3');
    expect(useFolderStore.getState().isGuestMode).toBe(true);

    useFolderStore.setState({
      folders: [
        {
          id: 'persisted-root',
          name: 'Persisted Root',
          parentId: null,
          albums: [],
          subfolders: [],
          isExpanded: true,
          viewMode: 'grid',
        } as any,
      ],
    });
    exitGuestMode();
    expect(useFolderStore.getState().isGuestMode).toBe(false);
    expect(useFolderStore.getState().sharedFolders).toBe(null);
    expect(useFolderStore.getState().selectedFolderId).toBe('persisted-root');
  });

  it('applies sync state values directly', () => {
    const stateBefore = useFolderStore.getState();
    const syncState: SyncState = {
      folders: [],
      selectedFolderId: 'synced',
      streamingProvider: 'apple',
      hasSetPreference: true,
      spotifyToken: 'token',
      spotifyTokenExpiry: 100,
      spotifyTokenTimestamp: 200,
      theme: 'mint',
      geistFont: 'mono',
      lastUpdated: stateBefore.lastUpdated + 1,
    };

    applySyncState(syncState);

    const stateAfter = useFolderStore.getState();
    expect(stateAfter.selectedFolderId).toBe('synced');
    expect(stateAfter.streamingProvider).toBe('apple');
    expect(stateAfter.theme).toBe('mint');
  });

  describe('Security: Setter Hardening', () => {
    it('setSelectedFolder should reject unsafe IDs', () => {
      const { setSelectedFolder } = useFolderStore.getState();
      setSelectedFolder('safe-id-123');
      expect(useFolderStore.getState().selectedFolderId).toBe('safe-id-123');

      setSelectedFolder('malicious-id&param=value');
      expect(useFolderStore.getState().selectedFolderId).toBeNull();
    });

    it('createFolder should reject unsafe parentId', () => {
      const { createFolder } = useFolderStore.getState();
      createFolder('New Folder', 'malicious-id&param=value');

      const folders = useFolderStore.getState().folders;
      expect(folders[0].parentId).toBeNull();
    });

    it('setSpotifyToken should reject tokens with control characters', () => {
      const { setSpotifyToken } = useFolderStore.getState();
      const unsafeToken = 'token\nwith\nnewlines';
      setSpotifyToken(unsafeToken, 3600, Date.now());
      expect(useFolderStore.getState().spotifyToken).toBeNull();
    });

    it('setSpotifyToken should reject non-positive or non-finite metadata', () => {
      const { setSpotifyToken } = useFolderStore.getState();

      setSpotifyToken('valid-token', -1, Date.now());
      expect(useFolderStore.getState().spotifyTokenExpiry).toBeNull();

      setSpotifyToken('valid-token', 3600, -100);
      expect(useFolderStore.getState().spotifyTokenTimestamp).toBeNull();

      setSpotifyToken('valid-token', Infinity, Date.now());
      expect(useFolderStore.getState().spotifyTokenExpiry).toBeNull();
    });
  });
});
