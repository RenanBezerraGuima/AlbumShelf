import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Folder, Album } from './types';

export type StreamingProvider = 'deezer' | 'apple';

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
  
  // Folder actions
  createFolder: (name: string, parentId: string | null) => void;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  toggleFolderExpanded: (id: string) => void;
  setSelectedFolder: (id: string | null) => void;
  moveFolder: (folderId: string, newParentId: string | null, targetFolderId: string | null) => void;
  
  // Album actions
  addAlbumToFolder: (folderId: string, album: Album) => void;
  removeAlbumFromFolder: (folderId: string, albumId: string) => void;
  moveAlbum: (fromFolderId: string, toFolderId: string, albumId: string) => void;
  reorderAlbum: (folderId: string, fromIndex: number, toIndex: number) => void;
  
  // Drag and drop
  setDraggedAlbum: (album: Album | null, folderId: string | null, index: number | null) => void;
  setDraggedFolderId: (folderId: string | null) => void;
  setDraggedFolder: (folder: Folder | null, parentId: string | null) => void;
  importFolders: (folders: Folder[]) => void;
  setStreamingProvider: (provider: StreamingProvider) => void;
  setHasSetPreference: (hasSet: boolean) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const findFolder = (folders: Folder[], id: string): Folder | null => {
  for (const folder of folders) {
    if (folder.id === id) return folder;
    const found = findFolder(folder.subfolders, id);
    if (found) return found;
  }
  return null;
};

export const getBreadcrumb = (folders: Folder[], targetId: string): string[] => {
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
  return path;
};

const updateFolderInTree = (
  folders: Folder[],
  id: string,
  updater: (folder: Folder) => Folder
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
  newFolder: Folder
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
    const newSubfolders = addFolderToTree(folder.subfolders, parentId, newFolder);
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

const isDescendant = (folders: Folder[], ancestorId: string, descendantId: string): boolean => {
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
  targetId: string | null
): Folder[] => {
  if (parentId === null) {
    // Insert at root level
    if (targetId === null) {
      return [...folders, folder];
    }
    const targetIndex = folders.findIndex(f => f.id === targetId);
    if (targetIndex === -1) return [...folders, folder];
    const newFolders = [...folders];
    newFolders.splice(targetIndex, 0, folder);
    return newFolders;
  }
  
  let changed = false;
  const newFolders = folders.map(f => {
    if (f.id === parentId) {
      changed = true;
      if (targetId === null) {
        return { ...f, subfolders: [...f.subfolders, folder] };
      }
      const targetIndex = f.subfolders.findIndex(sf => sf.id === targetId);
      if (targetIndex === -1) return { ...f, subfolders: [...f.subfolders, folder] };
      const newSubfolders = [...f.subfolders];
      newSubfolders.splice(targetIndex, 0, folder);
      return { ...f, subfolders: newSubfolders };
    }
    const newSubfolders = insertFolderAtPosition(f.subfolders, parentId, folder, targetId);
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
      streamingProvider: 'deezer',
      hasSetPreference: false,

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
        }));
      },

      renameFolder: (id, name) => {
        set((state) => ({
          folders: updateFolderInTree(state.folders, id, (folder) => ({
            ...folder,
            name: name.slice(0, 100),
          })),
        }));
      },

      deleteFolder: (id) => {
        set((state) => ({
          folders: deleteFolderFromTree(state.folders, id),
          selectedFolderId:
            state.selectedFolderId === id ? null : state.selectedFolderId,
        }));
      },

      toggleFolderExpanded: (id) => {
        set((state) => ({
          folders: updateFolderInTree(state.folders, id, (folder) => ({
            ...folder,
            isExpanded: !folder.isExpanded,
          })),
        }));
      },

      setSelectedFolder: (id) => {
        set({ selectedFolderId: id });
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
        newFolders = insertFolderAtPosition(newFolders, newParentId, movedFolder, targetFolderId);
        
        set({ folders: newFolders });
      },

      addAlbumToFolder: (folderId, album) => {
        set((state) => ({
          folders: updateFolderInTree(state.folders, folderId, (folder) => {
            // Check by id or spotifyId to prevent duplicates
            const isDuplicate = folder.albums.some((a) => {
              if (a.id === album.id) return true;
              if (a.spotifyId && album.spotifyId && a.spotifyId === album.spotifyId) return true;
              return false;
            });

            if (isDuplicate) {
              return folder;
            }
            return {
              ...folder,
              albums: [...folder.albums, album],
            };
          }),
        }));
      },

      removeAlbumFromFolder: (folderId, albumId) => {
        set((state) => ({
          folders: updateFolderInTree(state.folders, folderId, (folder) => ({
            ...folder,
            albums: folder.albums.filter((a) => a.id !== albumId),
          })),
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

        let newFolders = updateFolderInTree(
          state.folders,
          fromFolderId,
          (folder) => ({
            ...folder,
            albums: folder.albums.filter((a) => a.id !== albumId),
          })
        );

        newFolders = updateFolderInTree(newFolders, toFolderId, (folder) => ({
          ...folder,
          albums: [...folder.albums, album],
        }));

        set({ folders: newFolders });
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
        }));
      },

      setDraggedAlbum: (album, folderId, index) => {
        set({
          draggedAlbum: album,
          draggedFolderId: folderId,
          draggedAlbumIndex: index
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

        const regenerateIds = (folders: Folder[], parentId: string | null): Folder[] => {
          return folders.map((folder) => {
            const newId = generateId();
            return {
              ...folder,
              id: newId,
              parentId,
              subfolders: regenerateIds(folder.subfolders, newId),
            };
          });
        };

        const processedImported = regenerateIds(importedFolders, null);
        const existingFolders = [...state.folders];

        const existingNames = new Set(existingFolders.map(f => f.name));
        const importedNames = new Set(processedImported.map(f => f.name));

        const collidingNames = [...importedNames].filter(name => existingNames.has(name));

        if (collidingNames.length > 0) {
          const collidingSet = new Set(collidingNames);

          const updatedExisting = existingFolders.map(f => {
            if (collidingSet.has(f.name)) {
              return { ...f, name: `${f.name} (OLD)` };
            }
            return f;
          });

          const updatedImported = processedImported.map(f => {
            if (collidingSet.has(f.name)) {
              return { ...f, name: `${f.name} (NEW)` };
            }
            return f;
          });

          set({ folders: [...updatedExisting, ...updatedImported] });
        } else {
          set({ folders: [...existingFolders, ...processedImported] });
        }
      },

      setStreamingProvider: (provider) => {
        set({ streamingProvider: provider });
      },

      setHasSetPreference: (hasSet) => {
        set({ hasSetPreference: hasSet });
      },
    }),
    {
      name: 'album-shelf-storage',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const val = localStorage.getItem(name);
          if (val) return val;
          // Fallback to old key to restore "disappeared" data
          return localStorage.getItem('album-organizer-storage');
        },
        setItem: (name, value) => localStorage.setItem(name, value),
        removeItem: (name) => localStorage.removeItem(name),
      })),
    }
  )
);
