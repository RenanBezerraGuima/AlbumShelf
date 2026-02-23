import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Folder, Album, Theme, AlbumViewMode, StreamingProvider, GeistFont } from "./types";
import {
  sanitizeUrl,
  sanitizeImageUrl,
  sanitizeAlbum,
  sanitizeFolder,
  isValidTheme,
  isValidViewMode,
  isValidStreamingProvider,
} from "./security";
import { createInitialAlbumPosition, normalizeAlbumPosition } from "./spatial";

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
  geistFont: GeistFont;
  isSettingsOpen: boolean;
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
  setGeistFont: (font: GeistFont) => void;
  setSettingsOpen: (open: boolean) => void;
  setFolderViewMode: (id: string, mode: AlbumViewMode) => void;
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
  | "geistFont"
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
  geistFont: state.geistFont,
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
const breadcrumbCache = new WeakMap<
  Folder[],
  Map<string, { id: string; name: string }[]>
>();

// Performance: Cache for individual breadcrumb segment objects to ensure stable references across re-renders.
// Since the store uses structural sharing, unmodified folders retain their references.
// Caching the {id, name} objects allows useShallow to skip re-renders for unchanged paths.
const segmentCache = new WeakMap<Folder, { id: string; name: string }>();

const getBreadcrumbSegment = (folder: Folder): { id: string; name: string } => {
  let segment = segmentCache.get(folder);
  if (!segment) {
    segment = { id: folder.id, name: folder.name };
    segmentCache.set(folder, segment);
  }
  return segment;
};

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
): { id: string; name: string }[] => {
  let cache = breadcrumbCache.get(folders);
  if (!cache) {
    cache = new Map();
    breadcrumbCache.set(folders, cache);
  }
  if (cache.has(targetId)) return cache.get(targetId)!;

  for (const folder of folders) {
    if (folder.id === targetId) {
      const result = [getBreadcrumbSegment(folder)];
      cache.set(targetId, result);
      return result;
    }
    const subPath = getBreadcrumb(folder.subfolders, targetId);
    if (subPath.length > 0) {
      const result = [getBreadcrumbSegment(folder), ...subPath];
      cache.set(targetId, result);
      return result;
    }
  }

  cache.set(targetId, []);
  return [];
};

const updateFolderInTree = (
  folders: Folder[],
  id: string,
  updater: (folder: Folder) => Folder,
): Folder[] => {
  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    if (folder.id === id) {
      const updated = updater(folder);
      // Performance: If the updater returns the same folder reference, bail early
      // to preserve array reference stability for structural sharing.
      if (updated === folder) return folders;
      const result = [...folders];
      result[i] = updated;
      return result;
    }
    const newSubfolders = updateFolderInTree(folder.subfolders, id, updater);
    if (newSubfolders !== folder.subfolders) {
      const result = [...folders];
      result[i] = { ...folder, subfolders: newSubfolders };
      return result;
    }
  }
  return folders;
};

const deleteFolderFromTree = (folders: Folder[], id: string): Folder[] => {
  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    if (folder.id === id) {
      return folders.filter((_, index) => index !== i);
    }
    const newSubfolders = deleteFolderFromTree(folder.subfolders, id);
    if (newSubfolders !== folder.subfolders) {
      const result = [...folders];
      result[i] = { ...folder, subfolders: newSubfolders };
      return result;
    }
  }
  return folders;
};

const addFolderToTree = (
  folders: Folder[],
  parentId: string | null,
  newFolder: Folder,
): Folder[] => {
  if (parentId === null) {
    return [...folders, newFolder];
  }

  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    if (folder.id === parentId) {
      const result = [...folders];
      result[i] = {
        ...folder,
        subfolders: [...folder.subfolders, newFolder],
      };
      return result;
    }
    const newSubfolders = addFolderToTree(
      folder.subfolders,
      parentId,
      newFolder,
    );
    if (newSubfolders !== folder.subfolders) {
      const result = [...folders];
      result[i] = { ...folder, subfolders: newSubfolders };
      return result;
    }
  }

  return folders;
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

  for (let i = 0; i < folders.length; i++) {
    const f = folders[i];
    if (f.id === parentId) {
      const result = [...folders];
      if (targetId === null) {
        result[i] = { ...f, subfolders: [...f.subfolders, folder] };
      } else {
        const targetIndex = f.subfolders.findIndex((sf) => sf.id === targetId);
        const newSubfolders = [...f.subfolders];
        if (targetIndex === -1) {
          newSubfolders.push(folder);
        } else {
          newSubfolders.splice(targetIndex, 0, folder);
        }
        result[i] = { ...f, subfolders: newSubfolders };
      }
      return result;
    }
    const newSubfolders = insertFolderAtPosition(
      f.subfolders,
      parentId,
      folder,
      targetId,
    );
    if (newSubfolders !== f.subfolders) {
      const result = [...folders];
      result[i] = { ...f, subfolders: newSubfolders };
      return result;
    }
  }

  return folders;
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
      geistFont: "mono",
      isSettingsOpen: false,
      lastUpdated: 0,

      createFolder: (name, parentId) => {
        const newFolder: Folder = {
          id: generateId(),
          name: name.slice(0, 100),
          parentId: parentId ? String(parentId).slice(0, 100) : null,
          albums: [],
          subfolders: [],
          isExpanded: true,
          viewMode: "grid",
        };
        set((state) => {
          const newFolders = addFolderToTree(state.folders, parentId, newFolder);
          if (newFolders === state.folders) return state;
          return {
            folders: newFolders,
            lastUpdated: Date.now(),
          };
        });
      },

      renameFolder: (id, name) => {
        const slicedName = name.slice(0, 100);
        set((state) => {
          const newFolders = updateFolderInTree(state.folders, id, (folder) => {
            if (folder.name === slicedName) return folder;
            return { ...folder, name: slicedName };
          });
          if (newFolders === state.folders) return state;
          return {
            folders: newFolders,
            lastUpdated: Date.now(),
          };
        });
      },

      deleteFolder: (id) => {
        set((state) => {
          const newFolders = deleteFolderFromTree(state.folders, id);
          if (newFolders === state.folders) return state;
          return {
            folders: newFolders,
            selectedFolderId:
              state.selectedFolderId === id ? null : state.selectedFolderId,
            lastUpdated: Date.now(),
          };
        });
      },

      toggleFolderExpanded: (id) => {
        set((state) => {
          const newFolders = updateFolderInTree(state.folders, id, (folder) => ({
            ...folder,
            isExpanded: !folder.isExpanded,
          }));
          if (newFolders === state.folders) return state;
          return {
            folders: newFolders,
            lastUpdated: Date.now(),
          };
        });
      },

      setSelectedFolder: (id) => {
        const newId = id ? String(id).slice(0, 100) : null;
        if (get().selectedFolderId === newId) return;
        set({ selectedFolderId: newId, lastUpdated: Date.now() });
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
        set((state) => {
          const newFolders = updateFolderInTree(state.folders, folderId, (folder) => {
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
          });
          if (newFolders === state.folders) return state;
          return {
            folders: newFolders,
            lastUpdated: Date.now(),
          };
        });
      },

      removeAlbumFromFolder: (folderId, albumId) => {
        set((state) => {
          const newFolders = updateFolderInTree(state.folders, folderId, (folder) => {
            const newAlbums = folder.albums.filter((a) => a.id !== albumId);
            if (newAlbums.length === folder.albums.length) return folder;
            return { ...folder, albums: newAlbums };
          });
          if (newFolders === state.folders) return state;
          return {
            folders: newFolders,
            lastUpdated: Date.now(),
          };
        });
      },

      moveAlbum: (fromFolderId, toFolderId, albumId) => {
        const state = get();
        if (fromFolderId === toFolderId) return;

        const fromFolder = findFolder(state.folders, fromFolderId);
        const toFolder = findFolder(state.folders, toFolderId);
        if (!fromFolder || !toFolder) return;

        const album = fromFolder.albums.find((a) => a.id === albumId);
        if (!album) return;

        // Check if album already exists in target folder by id or spotifyId
        const isDuplicate = toFolder.albums.some((a) => {
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

        if (newFolders === state.folders) return;
        set({ folders: newFolders, lastUpdated: Date.now() });
      },

      reorderAlbum: (folderId, fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        set((state) => {
          const newFolders = updateFolderInTree(state.folders, folderId, (folder) => {
            if (fromIndex < 0 || fromIndex >= folder.albums.length || toIndex < 0 || toIndex >= folder.albums.length) return folder;
            const newAlbums = [...folder.albums];
            const [movedAlbum] = newAlbums.splice(fromIndex, 1);
            newAlbums.splice(toIndex, 0, movedAlbum);
            return {
              ...folder,
              albums: newAlbums,
            };
          });
          if (newFolders === state.folders) return state;
          return {
            folders: newFolders,
            lastUpdated: Date.now(),
          };
        });
      },

      setAlbumPosition: (folderId, albumId, x, y) => {
        set((state) => {
          const newFolders = updateFolderInTree(state.folders, folderId, (folder) => {
            let changed = false;
            const newAlbums = folder.albums.map((album, index) => {
              if (album.id === albumId) {
                const normalized = normalizeAlbumPosition(album, index);
                if (normalized.position?.x === x && normalized.position?.y === y) return album;
                changed = true;
                return {
                  ...normalized,
                  position: { x, y },
                };
              }
              return album;
            });
            if (!changed) return folder;
            return { ...folder, albums: newAlbums };
          });
          if (newFolders === state.folders) return state;
          return {
            folders: newFolders,
            lastUpdated: Date.now(),
          };
        });
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
        if (!Array.isArray(importedFolders)) return;

        const processedImported = importedFolders.map((f: any) =>
          sanitizeFolder(f, true, null, normalizeAlbumPosition),
        );
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
        if (!isValidStreamingProvider(provider) || get().streamingProvider === provider) return;
        set({ streamingProvider: provider, lastUpdated: Date.now() });
      },

      setHasSetPreference: (hasSet) => {
        if (get().hasSetPreference === hasSet) return;
        set({ hasSetPreference: hasSet, lastUpdated: Date.now() });
      },

      setSpotifyToken: (token, expiresIn, timestamp) => {
        set({
          spotifyToken: token ? String(token).slice(0, 1024) : null,
          spotifyTokenExpiry: typeof expiresIn === 'number' && Number.isFinite(expiresIn) ? expiresIn : null,
          spotifyTokenTimestamp: typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : null,
          lastUpdated: Date.now(),
        });
      },

      setTheme: (theme) => {
        if (!isValidTheme(theme) || get().theme === theme) return;
        set({ theme, lastUpdated: Date.now() });
      },

      setGeistFont: (font) => {
        if (get().geistFont === "mono") return;
        set({ geistFont: "mono", lastUpdated: Date.now() });
      },

      setSettingsOpen: (open) => {
        if (get().isSettingsOpen === open) return;
        set({ isSettingsOpen: open });
      },

      setFolderViewMode: (id, mode) => {
        if (!isValidViewMode(mode)) return;
        set((state) => {
          const newFolders = updateFolderInTree(state.folders, id, (folder) => {
            if (folder.viewMode === mode) return folder;
            return { ...folder, viewMode: mode };
          });
          if (newFolders === state.folders) return state;
          return {
            folders: newFolders,
            lastUpdated: Date.now(),
          };
        });
      },
    }),
    {
      name: "album-shelf-storage",
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Defense-in-depth: Validate rehydrated state from untrusted localStorage
          if (Array.isArray(state.folders)) {
            state.folders = state.folders.map((f: any) => sanitizeFolder(f));
          } else {
            state.folders = [];
          }

          state.selectedFolderId = typeof state.selectedFolderId === 'string' ? state.selectedFolderId.slice(0, 100) : null;
          state.hasSetPreference = Boolean(state.hasSetPreference);
          state.spotifyTokenExpiry = typeof state.spotifyTokenExpiry === 'number' && Number.isFinite(state.spotifyTokenExpiry) ? state.spotifyTokenExpiry : null;
          state.spotifyTokenTimestamp = typeof state.spotifyTokenTimestamp === 'number' && Number.isFinite(state.spotifyTokenTimestamp) ? state.spotifyTokenTimestamp : null;

          if (!isValidTheme(state.theme)) state.theme = "industrial";
          if (!isValidStreamingProvider(state.streamingProvider))
            state.streamingProvider = "deezer";
          if (state.spotifyToken)
            state.spotifyToken = String(state.spotifyToken).slice(0, 1024);
          if (
            typeof state.lastUpdated !== "number" ||
            !Number.isFinite(state.lastUpdated)
          ) {
            state.lastUpdated = Date.now();
          }
        }
      },
      // Exclude drag-and-drop state from persistence to avoid unnecessary
      // localStorage writes and expensive serialization during drag operations.
      partialize: (state) => {
        const {
          draggedAlbum,
          draggedFolderId,
          draggedAlbumIndex,
          draggedFolder,
          draggedFolderParentId,
          isSettingsOpen,
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
