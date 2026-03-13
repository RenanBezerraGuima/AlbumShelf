import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Folder, Album, Theme, AlbumViewMode, StreamingProvider, GeistFont } from "./types";
import {
  sanitizeUrl,
  sanitizeImageUrl,
  sanitizeAlbum,
  sanitizeFolderTree,
  isValidTheme,
  isValidViewMode,
  isValidStreamingProvider,
  isValidGeistFont,
  sanitizeText,
  SAFE_ID_REGEXP,
  DISALLOWED_URL_CHARS_REGEXP,
  MAX_ID_LENGTH,
  MAX_NAME_LENGTH,
  MAX_TOKEN_LENGTH,
  MAX_TOTAL_ALBUMS,
  MAX_TOTAL_FOLDERS,
  MAX_FOLDER_DEPTH,
  MAX_ALBUMS_PER_FOLDER,
  MAX_SUBFOLDERS_PER_FOLDER,
  countTreeItems,
  getTreeDepth,
} from "./security";
import { createInitialAlbumPosition, normalizeAlbumPosition } from "./spatial";

interface FolderStore {
  folders: Folder[];
  sharedFolders: Folder[] | null;
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
  isGuestMode: boolean;
  hydrationProgress: { current: number; total: number } | null;
  lastUpdated: number;

  // Folder actions
  createFolder: (name: string, parentId: string | null) => void;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  toggleFolderExpanded: (id: string) => void;
  setSelectedFolder: (id: string | null) => void;
  setIsGuestMode: (isGuestMode: boolean) => void;
  exitGuestMode: () => void;
  setSharedFolders: (folders: Folder[] | null) => void;
  hydrateSharedFolders: (albumMap: Map<string, Album>) => void;
  moveFolder: (
    folderId: string,
    newParentId: string | null,
    targetFolderId: string | null,
  ) => void;

  // Album actions
  addAlbumToFolder: (folderId: string, album: Album) => void;
  removeAlbumFromFolder: (folderId: string, albumId: string) => void;
  removeAlbumsFromFolder: (folderId: string, albumIds: string[]) => void;
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
  setHydrationProgress: (progress: { current: number; total: number } | null) => void;
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
const breadcrumbCache = new WeakMap<
  Folder[],
  Map<string, { id: string; name: string }[]>
>();

// Performance: Cache for individual breadcrumb segment objects to ensure stable references across re-renders.
// Since the store uses structural sharing, unmodified folders retain their references.
// Caching the {id, name} objects allows useShallow to skip re-renders for unchanged paths.
const segmentCache = new WeakMap<Folder, { id: string; name: string }>();

const folderIndexCache = new WeakMap<Folder[], Map<string, Folder>>();

const getBreadcrumbSegment = (folder: Folder): { id: string; name: string } => {
  let segment = segmentCache.get(folder);
  if (!segment) {
    segment = { id: folder.id, name: folder.name };
    segmentCache.set(folder, segment);
  }
  return segment;
};

const visitFolderTree = (nodes: Folder[], index: Map<string, Folder>) => {
  for (let i = 0; i < nodes.length; i++) {
    const folder = nodes[i];
    index.set(folder.id, folder);
    if (folder.subfolders.length > 0) {
      visitFolderTree(folder.subfolders, index);
    }
  }
};

const getFolderTreeIndex = (folders: Folder[]): Map<string, Folder> => {
  let index = folderIndexCache.get(folders);
  if (index) return index;

  const foldersById = new Map<string, Folder>();
  visitFolderTree(folders, foldersById);
  folderIndexCache.set(folders, foldersById);
  return foldersById;
};

export const findFolder = (folders: Folder[], id: string): Folder | null => {
  if (folders.length === 0) return null;
  return getFolderTreeIndex(folders).get(id) ?? null;
};

export const getBreadcrumb = (
  folders: Folder[],
  targetId: string,
): { id: string; name: string }[] => {
  if (folders.length === 0) return [];

  let cache = breadcrumbCache.get(folders);
  if (!cache) {
    cache = new Map();
    breadcrumbCache.set(folders, cache);
  }

  const cached = cache.get(targetId);
  if (cached) return cached;

  const foldersById = getFolderTreeIndex(folders);
  const path: { id: string; name: string }[] = [];
  let currentId: string | null = targetId;

  // Performance: Lazily reconstruct breadcrumb by traversing up parentId chain.
  // This avoids O(N * depth) pre-calculation of all paths during indexing.
  // Using push() and reverse() is O(depth) whereas unshift() would be O(depth^2).
  while (currentId) {
    const folder = foldersById.get(currentId);
    if (!folder) break;
    path.push(getBreadcrumbSegment(folder));
    currentId = folder.parentId;
  }

  path.reverse();
  cache.set(targetId, path);
  return path;
};

const getFolderDepth = (folders: Folder[], id: string): number => {
  return getBreadcrumb(folders, id).length;
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
  const foldersById = getFolderTreeIndex(folders);
  let currentId: string | null = descendantId;

  while (currentId) {
    if (currentId === ancestorId) return true;
    const folder = foldersById.get(currentId);
    currentId = folder ? folder.parentId : null;
  }

  return false;
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
      sharedFolders: null,
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
      isGuestMode: false,
      hydrationProgress: null,
      lastUpdated: 0,

      createFolder: (name, parentId) => {
        const sanitizedParentId = parentId ? String(parentId).slice(0, MAX_ID_LENGTH) : null;
        const finalParentId = (sanitizedParentId && SAFE_ID_REGEXP.test(sanitizedParentId)) ? sanitizedParentId : null;

        set((state) => {
          const currentFolders = state.sharedFolders ?? state.folders;
          const context = countTreeItems(currentFolders);

          // Security: Enforce global total folder limit
          if (context.totalFolders >= MAX_TOTAL_FOLDERS) return state;

          if (finalParentId) {
            const parent = findFolder(currentFolders, finalParentId);
            if (!parent) return state;

            // Security: Enforce per-folder subfolder limit
            if (parent.subfolders.length >= MAX_SUBFOLDERS_PER_FOLDER) return state;

            // Security: Enforce maximum folder depth
            if (getFolderDepth(currentFolders, finalParentId) >= MAX_FOLDER_DEPTH) return state;
          } else {
            // Security: Enforce root-level folder limit
            if (currentFolders.length >= MAX_SUBFOLDERS_PER_FOLDER) return state;
          }

          const sanitizedName = sanitizeText(name, MAX_NAME_LENGTH) || 'Untitled';

          const newFolder: Folder = {
            id: generateId(),
            name: sanitizedName,
            parentId: finalParentId,
            albums: [],
            subfolders: [],
            isExpanded: true,
            viewMode: "grid",
          };

          const newFolders = addFolderToTree(currentFolders, finalParentId, newFolder);
          if (newFolders === currentFolders) return state;
          if (state.sharedFolders) {
            return { sharedFolders: newFolders, lastUpdated: Date.now() };
          }
          return {
            folders: newFolders,
            lastUpdated: Date.now(),
          };
        });
      },

      renameFolder: (id, name) => {
        const sanitizedName = sanitizeText(name, MAX_NAME_LENGTH);
        set((state) => {
          const currentFolders = state.sharedFolders ?? state.folders;
          const newFolders = updateFolderInTree(currentFolders, id, (folder) => {
            if (folder.name === sanitizedName) return folder;
            return { ...folder, name: sanitizedName };
          });
          if (newFolders === currentFolders) return state;
          if (state.sharedFolders) {
            return { sharedFolders: newFolders, lastUpdated: Date.now() };
          }
          return {
            folders: newFolders,
            lastUpdated: Date.now(),
          };
        });
      },

      deleteFolder: (id) => {
        set((state) => {
          const currentFolders = state.sharedFolders ?? state.folders;
          const newFolders = deleteFolderFromTree(currentFolders, id);
          if (newFolders === currentFolders) return state;

          const newState: any = {
            lastUpdated: Date.now(),
            selectedFolderId: state.selectedFolderId === id ? null : state.selectedFolderId,
          };

          if (state.sharedFolders) {
            newState.sharedFolders = newFolders;
          } else {
            newState.folders = newFolders;
          }

          return newState;
        });
      },

      toggleFolderExpanded: (id) => {
        set((state) => {
          const currentFolders = state.sharedFolders ?? state.folders;
          const newFolders = updateFolderInTree(currentFolders, id, (folder) => ({
            ...folder,
            isExpanded: !folder.isExpanded,
          }));
          if (newFolders === currentFolders) return state;
          if (state.sharedFolders) {
            return { sharedFolders: newFolders, lastUpdated: Date.now() };
          }
          return {
            folders: newFolders,
            lastUpdated: Date.now(),
          };
        });
      },

      setSelectedFolder: (id) => {
        const sanitizedId = id ? String(id).slice(0, MAX_ID_LENGTH) : null;
        const newId = (sanitizedId && SAFE_ID_REGEXP.test(sanitizedId)) ? sanitizedId : null;

        if (get().selectedFolderId === newId) return;
        set({ selectedFolderId: newId, lastUpdated: Date.now() });
      },

      setIsGuestMode: (isGuestMode) => {
        set({ isGuestMode, lastUpdated: Date.now() });
      },

      exitGuestMode: () => {
        set((state) => ({
          sharedFolders: null,
          isGuestMode: false,
          selectedFolderId: state.folders.length > 0 ? state.folders[0].id : null,
          lastUpdated: Date.now()
        }));
      },

      setSharedFolders: (folders) => {
        set({ sharedFolders: folders, lastUpdated: Date.now() });
      },

      hydrateSharedFolders: (albumMap) => {
        set((state) => {
          if (!state.sharedFolders || albumMap.size === 0) return state;

          const hydrateNode = (folders: Folder[]): Folder[] => {
            let anyFolderChanged = false;
            const result = [];

            for (let i = 0; i < folders.length; i++) {
              const f = folders[i];

              let albumsChanged = false;
              let updatedAlbums = null;

              for (let j = 0; j < f.albums.length; j++) {
                const a = f.albums[j];
                const hydrated = albumMap.get(a.id);
                if (hydrated) {
                  if (!updatedAlbums) {
                    updatedAlbums = [...f.albums];
                  }
                  albumsChanged = true;
                  updatedAlbums[j] = { ...hydrated, position: a.position };
                }
              }

              const newSubfolders = hydrateNode(f.subfolders);
              const subfoldersChanged = newSubfolders !== f.subfolders;

              if (albumsChanged || subfoldersChanged) {
                anyFolderChanged = true;
                result.push({
                  ...f,
                  albums: albumsChanged && updatedAlbums ? updatedAlbums : f.albums,
                  subfolders: newSubfolders,
                });
              } else {
                result.push(f);
              }
            }

            return anyFolderChanged ? result : folders;
          };

          const nextFolders = hydrateNode(state.sharedFolders);
          // Performance: Bail out if no albums were actually hydrated to preserve
          // structural sharing and prevent redundant re-renders.
          if (nextFolders === state.sharedFolders) return state;

          return {
            sharedFolders: nextFolders,
            lastUpdated: Date.now(),
          };
        });
      },

      moveFolder: (folderId, newParentId, targetFolderId) => {
        const state = get();
        const currentFolders = state.sharedFolders ?? state.folders;

        // Prevent moving a folder into itself or its descendants
        if (newParentId && isDescendant(currentFolders, folderId, newParentId)) {
          return;
        }
        if (folderId === newParentId) return;

        const folder = findFolder(currentFolders, folderId);
        if (!folder) return;

        // Security: Enforce maximum folder depth for the moved subtree
        const subtreeDepth = getTreeDepth([folder]);
        const parentDepth = newParentId ? getFolderDepth(currentFolders, newParentId) : 0;
        if (parentDepth + subtreeDepth > MAX_FOLDER_DEPTH) return;

        // Security: Enforce per-folder subfolder limit
        if (newParentId) {
          const parent = findFolder(currentFolders, newParentId);
          if (parent && parent.subfolders.length >= MAX_SUBFOLDERS_PER_FOLDER) return;
        } else {
          if (currentFolders.length >= MAX_SUBFOLDERS_PER_FOLDER) return;
        }

        // Remove folder from its current position
        let newFolders = deleteFolderFromTree(currentFolders, folderId);

        // Add folder to new position
        const movedFolder = { ...folder, parentId: newParentId };
        newFolders = insertFolderAtPosition(
          newFolders,
          newParentId,
          movedFolder,
          targetFolderId,
        );

        if (state.sharedFolders) {
          set({ sharedFolders: newFolders, lastUpdated: Date.now() });
        } else {
          set({ folders: newFolders, lastUpdated: Date.now() });
        }
      },

      addAlbumToFolder: (folderId, album) => {
        set((state) => {
          const currentFolders = state.sharedFolders ?? state.folders;
          const context = countTreeItems(currentFolders);

          // Security: Enforce global total album limit
          if (context.totalAlbums >= MAX_TOTAL_ALBUMS) return state;

          const newFolders = updateFolderInTree(currentFolders, folderId, (folder) => {
            // Security: Enforce per-folder album limit
            if (folder.albums.length >= MAX_ALBUMS_PER_FOLDER) return folder;

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
          if (newFolders === currentFolders) return state;
          if (state.sharedFolders) {
            return { sharedFolders: newFolders, lastUpdated: Date.now() };
          }
          return {
            folders: newFolders,
            lastUpdated: Date.now(),
          };
        });
      },

      removeAlbumFromFolder: (folderId, albumId) => {
        set((state) => {
          const currentFolders = state.sharedFolders ?? state.folders;
          const newFolders = updateFolderInTree(currentFolders, folderId, (folder) => {
            const newAlbums = folder.albums.filter((a) => a.id !== albumId);
            if (newAlbums.length === folder.albums.length) return folder;
            return { ...folder, albums: newAlbums };
          });
          if (newFolders === currentFolders) return state;
          if (state.sharedFolders) {
            return { sharedFolders: newFolders, lastUpdated: Date.now() };
          }
          return {
            folders: newFolders,
            lastUpdated: Date.now(),
          };
        });
      },

      removeAlbumsFromFolder: (folderId, albumIds) => {
        if (albumIds.length === 0) return;
        const albumIdsSet = new Set(albumIds);

        set((state) => {
          const currentFolders = state.sharedFolders ?? state.folders;
          const newFolders = updateFolderInTree(currentFolders, folderId, (folder) => {
            const newAlbums = folder.albums.filter((album) => !albumIdsSet.has(album.id));
            if (newAlbums.length === folder.albums.length) return folder;
            return { ...folder, albums: newAlbums };
          });
          if (newFolders === currentFolders) return state;
          if (state.sharedFolders) {
            return { sharedFolders: newFolders, lastUpdated: Date.now() };
          }
          return {
            folders: newFolders,
            lastUpdated: Date.now(),
          };
        });
      },

      moveAlbum: (fromFolderId, toFolderId, albumId) => {
        const state = get();
        if (fromFolderId === toFolderId) return;
        const currentFolders = state.sharedFolders ?? state.folders;

        const fromFolder = findFolder(currentFolders, fromFolderId);
        const toFolder = findFolder(currentFolders, toFolderId);
        if (!fromFolder || !toFolder) return;

        // Security: Enforce per-folder album limit for target
        if (toFolder.albums.length >= MAX_ALBUMS_PER_FOLDER) return;

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
          currentFolders,
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

        if (newFolders === currentFolders) return;
        if (state.sharedFolders) {
          set({ sharedFolders: newFolders, lastUpdated: Date.now() });
        } else {
          set({ folders: newFolders, lastUpdated: Date.now() });
        }
      },

      reorderAlbum: (folderId, fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        set((state) => {
          const currentFolders = state.sharedFolders ?? state.folders;
          const newFolders = updateFolderInTree(currentFolders, folderId, (folder) => {
            if (fromIndex < 0 || fromIndex >= folder.albums.length || toIndex < 0 || toIndex >= folder.albums.length) return folder;
            const newAlbums = [...folder.albums];
            const [movedAlbum] = newAlbums.splice(fromIndex, 1);
            newAlbums.splice(toIndex, 0, movedAlbum);
            return {
              ...folder,
              albums: newAlbums,
            };
          });
          if (newFolders === currentFolders) return state;
          if (state.sharedFolders) {
            return { sharedFolders: newFolders, lastUpdated: Date.now() };
          }
          return {
            folders: newFolders,
            lastUpdated: Date.now(),
          };
        });
      },

      setAlbumPosition: (folderId, albumId, x, y) => {
        // Defense-in-depth: Ensure coordinates are finite numbers
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        set((state) => {
          const currentFolders = state.sharedFolders ?? state.folders;
          const newFolders = updateFolderInTree(currentFolders, folderId, (folder) => {
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
          if (newFolders === currentFolders) return state;
          if (state.sharedFolders) {
            return { sharedFolders: newFolders, lastUpdated: Date.now() };
          }
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

        // Security: Enforce global limits during import by passing current state context
        const context = countTreeItems(state.folders);
        const processedImported = sanitizeFolderTree(
          importedFolders,
          true,
          normalizeAlbumPosition,
          context
        );

        if (processedImported.length === 0) return;

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
        const sanitizedToken = token ? String(token).slice(0, MAX_TOKEN_LENGTH) : null;
        const finalToken = (sanitizedToken && !DISALLOWED_URL_CHARS_REGEXP.test(sanitizedToken)) ? sanitizedToken : null;

        set({
          spotifyToken: finalToken,
          spotifyTokenExpiry: typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : null,
          spotifyTokenTimestamp: typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null,
          lastUpdated: Date.now(),
        });
      },

      setTheme: (theme) => {
        if (!isValidTheme(theme) || get().theme === theme) return;
        set({ theme, lastUpdated: Date.now() });
      },

      setGeistFont: (font) => {
        if (!isValidGeistFont(font) || get().geistFont === font) return;
        set({ geistFont: font, lastUpdated: Date.now() });
      },

      setSettingsOpen: (open) => {
        if (get().isSettingsOpen === open) return;
        set({ isSettingsOpen: open });
      },

      setHydrationProgress: (progress) => {
        set({ hydrationProgress: progress });
      },

      setFolderViewMode: (id, mode) => {
        if (!isValidViewMode(mode)) return;
        set((state) => {
          const currentFolders = state.sharedFolders ?? state.folders;
          const newFolders = updateFolderInTree(currentFolders, id, (folder) => {
            if (folder.viewMode === mode) return folder;
            return { ...folder, viewMode: mode };
          });
          if (newFolders === currentFolders) return state;
          if (state.sharedFolders) {
            return { sharedFolders: newFolders, lastUpdated: Date.now() };
          }
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
            state.folders = sanitizeFolderTree(state.folders);
          } else {
            state.folders = [];
          }

          state.selectedFolderId = typeof state.selectedFolderId === 'string' && SAFE_ID_REGEXP.test(state.selectedFolderId.slice(0, MAX_ID_LENGTH))
            ? state.selectedFolderId.slice(0, MAX_ID_LENGTH)
            : null;
          state.hasSetPreference = Boolean(state.hasSetPreference);

          // Defense-in-depth: Ensure numeric metadata is strictly positive
          state.spotifyTokenExpiry = typeof state.spotifyTokenExpiry === 'number' && Number.isFinite(state.spotifyTokenExpiry) && state.spotifyTokenExpiry > 0 ? state.spotifyTokenExpiry : null;
          state.spotifyTokenTimestamp = typeof state.spotifyTokenTimestamp === 'number' && Number.isFinite(state.spotifyTokenTimestamp) && state.spotifyTokenTimestamp > 0 ? state.spotifyTokenTimestamp : null;

          if (!isValidTheme(state.theme)) state.theme = "industrial";
          if (!isValidGeistFont(state.geistFont)) state.geistFont = "mono";
          if (!isValidStreamingProvider(state.streamingProvider))
            state.streamingProvider = "deezer";

          // Defense-in-depth: Harden token validation during rehydration
          if (state.spotifyToken) {
            const token = String(state.spotifyToken).slice(0, MAX_TOKEN_LENGTH);
            state.spotifyToken = (token && !DISALLOWED_URL_CHARS_REGEXP.test(token)) ? token : null;
          } else {
            state.spotifyToken = null;
          }
          if (
            typeof state.lastUpdated !== "number" ||
            !Number.isFinite(state.lastUpdated)
          ) {
            state.lastUpdated = Date.now();
          }
          // Always reset sharedFolders and guest mode on rehydration
          state.sharedFolders = null;
          state.isGuestMode = false;
        }
      },
      // Exclude drag-and-drop state and shared state from persistence
      partialize: (state) => {
        const {
          draggedAlbum,
          draggedFolderId,
          draggedAlbumIndex,
          draggedFolder,
          draggedFolderParentId,
          isSettingsOpen,
          isGuestMode,
          sharedFolders,
          hydrationProgress,
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
