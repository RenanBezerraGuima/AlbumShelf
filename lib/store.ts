import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Folder, Album, Theme } from "./types";
import { sanitizeUrl, sanitizeImageUrl, sanitizeAlbum } from "./security";
import { createInitialAlbumPosition, normalizeAlbumPosition } from "./spatial";

export type StreamingProvider = "deezer" | "apple" | "spotify";
export type AlbumViewMode = "grid" | "canvas";

interface FolderStore {
  folders: Folder[];
  selectedFolderId: string | null;
  draggedAlbum: Album | null;
  draggedFolderId: string | null;
  draggedAlbumIndex: number | null;
  draggedFolder: Folder | null;
  draggedFolderParentId: string | null;
  streamingProvider: StreamingProvider;
  hasSetPreference: boolean;
  spotifyToken: string | null;
  spotifyTokenExpiry: number | null;
  spotifyTokenTimestamp: number | null;
  theme: Theme;
  albumViewMode: AlbumViewMode;
  lastUpdated: number;

  // Folder actions
  createFolder: (name: string, parentId: string | null) => void;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  toggleFolderExpanded: (id: string) => void;
  setSelectedFolder: (id: string | null) => void;
  moveFolder: (
    folderId: string,
    newParentId: string | null,
    targetFolderId: string | null,
  ) => void;

  // Album actions
  addAlbumToFolder: (folderId: string, album: Album) => void;
  removeAlbumFromFolder: (folderId: string, albumId: string) => void;
  moveAlbum: (
    fromFolderId: string,
    toFolderId: string,
    albumId: string,
  ) => void;
  reorderAlbum: (folderId: string, fromIndex: number, toIndex: number) => void;
  setAlbumPosition: (
    folderId: string,
    albumId: string,
    x: number,
    y: number,
  ) => void;

  // Drag and drop
  setDraggedAlbum: (
    album: Album | null,
    folderId: string | null,
    index: number | null,
  ) => void;
  setDraggedFolderId: (folderId: string | null) => void;
  setDraggedFolder: (folder: Folder | null, parentId: string | null) => void;
  importFolders: (folders: Folder[]) => void;
  setStreamingProvider: (provider: StreamingProvider) => void;
  setHasSetPreference: (hasSet: boolean) => void;
  setSpotifyToken: (
    token: string | null,
    expiresIn: number | null,
    timestamp: number | null,
  ) => void;
  setTheme: (theme: Theme) => void;
  setAlbumViewMode: (mode: AlbumViewMode) => void;
}

export type SyncState = Pick<
  FolderStore,
  | "folders"
  | "selectedFolderId"
  | "streamingProvider"
  | "hasSetPreference"
  | "spotifyToken"
  | "spotifyTokenExpiry"
  | "spotifyTokenTimestamp"
  | "theme"
  | "albumViewMode"
  | "lastUpdated"
>;

const generateId = () => crypto.randomUUID();

export const selectSyncState = (state: FolderStore): SyncState => ({
  folders: state.folders,
  selectedFolderId: state.selectedFolderId,
  streamingProvider: state.streamingProvider,
  hasSetPreference: state.hasSetPreference,
  spotifyToken: state.spotifyToken,
  spotifyTokenExpiry: state.spotifyTokenExpiry,
  spotifyTokenTimestamp: state.spotifyTokenTimestamp,
  theme: state.theme,
  albumViewMode: state.albumViewMode,
  lastUpdated: state.lastUpdated,
});

export const applySyncState = (incoming: SyncState) => {
  useFolderStore.setState((state) => ({
    ...state,
    ...incoming,
  }));
};

// Caches for tree traversal to avoid O(N) operations during re-renders or state updates.
// WeakMap uses the 'folders' array reference as a key, ensuring cache is invalidated when tree changes.
const findCache = new WeakMap<Folder[], Map<string, Folder | null>>();
const breadcrumbCache = new WeakMap<Folder[], Map<string, string[]>>();

export const findFolder = (folders: Folder[], id: string): Folder | null => {
  let cache = findCache.get(folders);
  if (!cache) {
    cache = new Map();
    findCache.set(folders, cache);
  }
  if (cache.has(id)) return cache.get(id)!;

  let result: Folder | null = null;
  for (const folder of folders) {
    if (folder.id === id) {
      result = folder;
      break;
    }
    const found = findFolder(folder.subfolders, id);
    if (found) {
      result = found;
      break;
    }
  }

  cache.set(id, result);
  return result;
};

export const getBreadcrumb = (
  folders: Folder[],
  targetId: string,
): string[] => {
  let cache = breadcrumbCache.get(folders);
  if (!cache) {
    cache = new Map();
    breadcrumbCache.set(folders, cache);
  }
  if (cache.has(targetId)) return cache.get(targetId)!;

  const path: string[] = [];

  function find(folderList: Folder[], target: string): boolean {
    for (const folder of folderList) {
      if (folder.id === target) {
        path.push(folder.name);
        return true;
      }
      if (find(folder.subfolders, target)) {
        path.unshift(folder.name);
        return true;
      }
    }
    return false;
  }

  find(folders, targetId);
  cache.set(targetId, path);
  return path;
};

const updateFolderInTree = (
  folders: Folder[],
  id: string,
  updater: (folder: Folder) => Folder,
): Folder[] => {
  let changed = false;
  const newFolders = folders.map((folder) => {
    if (folder.id === id) {
      changed = true;
      return updater(folder);
    }
    const newSubfolders = updateFolderInTree(folder.subfolders, id, updater);
    if (newSubfolders !== folder.subfolders) {
      changed = true;
      return {
        ...folder,
        subfolders: newSubfolders,
      };
    }
    return folder;
  });
  return changed ? newFolders : folders;
};

const deleteFolderFromTree = (folders: Folder[], id: string): Folder[] => {
  let changed = false;
  const filtered = folders.filter((folder) => {
    if (folder.id === id) {
      changed = true;
      return false;
    }
    return true;
  });

  const newFolders = filtered.map((folder) => {
    const newSubfolders = deleteFolderFromTree(folder.subfolders, id);
    if (newSubfolders !== folder.subfolders) {
      changed = true;
      return {
        ...folder,
        subfolders: newSubfolders,
      };
    }
    return folder;
  });

  return changed ? newFolders : folders;
};

const addFolderToTree = (
  folders: Folder[],
  parentId: string | null,
  newFolder: Folder,
): Folder[] => {
  if (parentId === null) {
    return [...folders, newFolder];
  }

  let changed = false;
  const newFolders = folders.map((folder) => {
    if (folder.id === parentId) {
      changed = true;
      return {
        ...folder,
        subfolders: [...folder.subfolders, newFolder],
      };
    }
    const newSubfolders = addFolderToTree(
      folder.subfolders,
      parentId,
      newFolder,
    );
    if (newSubfolders !== folder.subfolders) {
      changed = true;
      return {
        ...folder,
        subfolders: newSubfolders,
      };
    }
    return folder;
  });

  return changed ? newFolders : folders;
};

const isDescendant = (
  folders: Folder[],
  ancestorId: string,
  descendantId: string,
): boolean => {
  const ancestor = findFolder(folders, ancestorId);
  if (!ancestor) return false;

  const checkDescendant = (folder: Folder): boolean => {
    if (folder.id === descendantId) return true;
    return folder.subfolders.some(checkDescendant);
  };

  return checkDescendant(ancestor);
};

const insertFolderAtPosition = (
  folders: Folder[],
  parentId: string | null,
  folder: Folder,
  targetId: string | null,
): Folder[] => {
  if (parentId === null) {
    // Insert at root level
    if (targetId === null) {
      return [...folders, folder];
    }
    const targetIndex = folders.findIndex((f) => f.id === targetId);
    if (targetIndex === -1) return [...folders, folder];
    const newFolders = [...folders];
    newFolders.splice(targetIndex, 0, folder);
    return newFolders;
  }

  let changed = false;
  const newFolders = folders.map((f) => {
    if (f.id === parentId) {
      changed = true;
      if (targetId === null) {
        return { ...f, subfolders: [...f.subfolders, folder] };
      }
      const targetIndex = f.subfolders.findIndex((sf) => sf.id === targetId);
      if (targetIndex === -1)
        return { ...f, subfolders: [...f.subfolders, folder] };
      const newSubfolders = [...f.subfolders];
      newSubfolders.splice(targetIndex, 0, folder);
      return { ...f, subfolders: newSubfolders };
    }
    const newSubfolders = insertFolderAtPosition(
      f.subfolders,
      parentId,
      folder,
      targetId,
    );
    if (newSubfolders !== f.subfolders) {
      changed = true;
      return {
        ...f,
        subfolders: newSubfolders,
      };
    }
    return f;
  });
  return changed ? newFolders : folders;
};

export const useFolderStore = create<FolderStore>()(
  persist(
    (set, get) => ({
      folders: [],
      selectedFolderId: null,
      draggedAlbum: null,
      draggedFolderId: null,
      draggedAlbumIndex: null,
      draggedFolder: null,
      draggedFolderParentId: null,
      streamingProvider: "deezer",
      hasSetPreference: false,
      spotifyToken: null,
      spotifyTokenExpiry: null,
      spotifyTokenTimestamp: null,
      theme: "industrial",
      albumViewMode: "grid",
      lastUpdated: 0,

      createFolder: (name, parentId) => {
        const newFolder: Folder = {
          id: generateId(),
          name: name.slice(0, 100),
          parentId,
          albums: [],
          subfolders: [],
          isExpanded: true,
        };
        set((state) => ({
          folders: addFolderToTree(state.folders, parentId, newFolder),
          lastUpdated: Date.now(),
        }));
      },

      renameFolder: (id, name) => {
        set((state) => ({
          folders: updateFolderInTree(state.folders, id, (folder) => ({
            ...folder,
            name: name.slice(0, 100),
          })),
          lastUpdated: Date.now(),
        }));
      },

      deleteFolder: (id) => {
        set((state) => ({
          folders: deleteFolderFromTree(state.folders, id),
          selectedFolderId:
            state.selectedFolderId === id ? null : state.selectedFolderId,
          lastUpdated: Date.now(),
        }));
      },

      toggleFolderExpanded: (id) => {
        set((state) => ({
          folders: updateFolderInTree(state.folders, id, (folder) => ({
            ...folder,
            isExpanded: !folder.isExpanded,
          })),
          lastUpdated: Date.now(),
        }));
      },

      setSelectedFolder: (id) => {
        set({ selectedFolderId: id, lastUpdated: Date.now() });
      },

      moveFolder: (folderId, newParentId, targetFolderId) => {
        const state = get();

        // Prevent moving a folder into itself or its descendants
        if (newParentId && isDescendant(state.folders, folderId, newParentId)) {
          return;
        }
        if (folderId === newParentId) return;

        const folder = findFolder(state.folders, folderId);
        if (!folder) return;

        // Remove folder from its current position
        let newFolders = deleteFolderFromTree(state.folders, folderId);

        // Add folder to new position
        const movedFolder = { ...folder, parentId: newParentId };
        newFolders = insertFolderAtPosition(
          newFolders,
          newParentId,
          movedFolder,
          targetFolderId,
        );

        set({ folders: newFolders, lastUpdated: Date.now() });
      },

      addAlbumToFolder: (folderId, album) => {
        set((state) => ({
          folders: updateFolderInTree(state.folders, folderId, (folder) => {
            // Check by id or spotifyId to prevent duplicates
            const isDuplicate = folder.albums.some((a) => {
              if (a.id === album.id) return true;
              if (
                a.spotifyId &&
                album.spotifyId &&
                a.spotifyId === album.spotifyId
              )
                return true;
              return false;
            });

            if (isDuplicate) {
              return folder;
            }

            // Sanitize album before adding to store
            const sanitizedAlbum = normalizeAlbumPosition(
              sanitizeAlbum(album),
              folder.albums.length,
            );

            return {
              ...folder,
              albums: [...folder.albums, sanitizedAlbum],
            };
          }),
          lastUpdated: Date.now(),
        }));
      },

      removeAlbumFromFolder: (folderId, albumId) => {
        set((state) => ({
          folders: updateFolderInTree(state.folders, folderId, (folder) => ({
            ...folder,
            albums: folder.albums.filter((a) => a.id !== albumId),
          })),
          lastUpdated: Date.now(),
        }));
      },

      moveAlbum: (fromFolderId, toFolderId, albumId) => {
        const state = get();
        const fromFolder = findFolder(state.folders, fromFolderId);
        const toFolder = findFolder(state.folders, toFolderId);
        if (!fromFolder || !toFolder) return;

        const album = fromFolder.albums.find((a) => a.id === albumId);
        if (!album) return;

        // Check if album already exists in target folder by spotifyId
        if (toFolder.albums.some((a) => a.spotifyId === album.spotifyId)) {
          return;
        }

        const positionedAlbum = normalizeAlbumPosition(album, toFolder.albums.length);

        let newFolders = updateFolderInTree(
          state.folders,
          fromFolderId,
          (folder) => ({
            ...folder,
            albums: folder.albums.filter((a) => a.id !== albumId),
          }),
        );

        newFolders = updateFolderInTree(newFolders, toFolderId, (folder) => ({
          ...folder,
          albums: [...folder.albums, positionedAlbum],
        }));

        set({ folders: newFolders, lastUpdated: Date.now() });
      },

      reorderAlbum: (folderId, fromIndex, toIndex) => {
        set((state) => ({
          folders: updateFolderInTree(state.folders, folderId, (folder) => {
            const newAlbums = [...folder.albums];
            const [movedAlbum] = newAlbums.splice(fromIndex, 1);
            newAlbums.splice(toIndex, 0, movedAlbum);
            return {
              ...folder,
              albums: newAlbums,
            };
          }),
          lastUpdated: Date.now(),
        }));
      },

      setAlbumPosition: (folderId, albumId, x, y) => {
        set((state) => ({
          folders: updateFolderInTree(state.folders, folderId, (folder) => ({
            ...folder,
            albums: folder.albums.map((album, index) =>
              album.id === albumId
                ? {
                    ...normalizeAlbumPosition(album, index),
                    position: { x, y },
                  }
                : album,
            ),
          })),
          lastUpdated: Date.now(),
        }));
      },

      setDraggedAlbum: (album, folderId, index) => {
        set({
          draggedAlbum: album,
          draggedFolderId: folderId,
          draggedAlbumIndex: index,
        });
      },

      setDraggedFolderId: (folderId) => {
        set({ draggedFolderId: folderId });
      },

      setDraggedFolder: (folder, parentId) => {
        set({ draggedFolder: folder, draggedFolderParentId: parentId });
      },

      importFolders: (importedFolders) => {
        const state = get();

        const sanitizeAndRegenerate = (
          folders: any[],
          parentId: string | null,
        ): Folder[] => {
          return folders.map((folder) => {
            const newId = generateId();

            // Sanitize albums
            const sanitizedAlbums: Album[] = (folder.albums || []).map(
              (album: any, index: number) =>
                normalizeAlbumPosition(
                  sanitizeAlbum({
                    ...album,
                    id: album.id || generateId(),
                  }),
                  index,
                ),
            );

            return {
              id: newId,
              name: String(folder.name || "Untitled").slice(0, 100),
              parentId,
              albums: sanitizedAlbums,
              subfolders: sanitizeAndRegenerate(folder.subfolders || [], newId),
              isExpanded: Boolean(folder.isExpanded),
            };
          });
        };

        const processedImported = sanitizeAndRegenerate(importedFolders, null);
        const existingFolders = [...state.folders];

        const existingNames = new Set(existingFolders.map((f) => f.name));
        const importedNames = new Set(processedImported.map((f) => f.name));

        const collidingNames = [...importedNames].filter((name) =>
          existingNames.has(name),
        );

        if (collidingNames.length > 0) {
          const collidingSet = new Set(collidingNames);

          const updatedExisting = existingFolders.map((f) => {
            if (collidingSet.has(f.name)) {
              return { ...f, name: `${f.name} (OLD)` };
            }
            return f;
          });

          const updatedImported = processedImported.map((f) => {
            if (collidingSet.has(f.name)) {
              return { ...f, name: `${f.name} (NEW)` };
            }
            return f;
          });

          set({
            folders: [...updatedExisting, ...updatedImported],
            lastUpdated: Date.now(),
          });
        } else {
          set({
            folders: [...existingFolders, ...processedImported],
            lastUpdated: Date.now(),
          });
        }
      },

      setStreamingProvider: (provider) => {
        set({ streamingProvider: provider, lastUpdated: Date.now() });
      },

      setHasSetPreference: (hasSet) => {
        set({ hasSetPreference: hasSet, lastUpdated: Date.now() });
      },

      setSpotifyToken: (token, expiresIn, timestamp) => {
        set({
          spotifyToken: token,
          spotifyTokenExpiry: expiresIn,
          spotifyTokenTimestamp: timestamp,
          lastUpdated: Date.now(),
        });
      },

      setTheme: (theme) => set({ theme, lastUpdated: Date.now() }),
      setAlbumViewMode: (mode) =>
        set({ albumViewMode: mode, lastUpdated: Date.now() }),
    }),
    {
      name: "album-shelf-storage",
      // Exclude drag-and-drop state from persistence to avoid unnecessary
      // localStorage writes and expensive serialization during drag operations.
      partialize: (state) => {
        const {
          draggedAlbum,
          draggedFolderId,
          draggedAlbumIndex,
          draggedFolder,
          draggedFolderParentId,
          ...persistedState
        } = state;
        return persistedState;
      },
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const val = localStorage.getItem(name);
          if (val) return val;
          // Fallback to old key to restore "disappeared" data
          return localStorage.getItem("album-organizer-storage");
        },
        setItem: (name, value) => localStorage.setItem(name, value),
        removeItem: (name) => localStorage.removeItem(name),
      })),
    },
  ),
);
