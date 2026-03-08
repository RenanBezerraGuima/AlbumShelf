import type { Folder } from './types';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface FolderSearchState {
  hasQuery: boolean;
  visibleFolderIds: Set<string>;
  forcedExpandedFolderIds: Set<string>;
}

export function getFolderSearchState(
  folders: Folder[],
  query: string,
): FolderSearchState {
  const trimmedQuery = query.trim();
  const visibleFolderIds = new Set<string>();
  const forcedExpandedFolderIds = new Set<string>();

  if (!trimmedQuery) {
    const collect = (nodes: Folder[]) => {
      for (const folder of nodes) {
        visibleFolderIds.add(folder.id);
        collect(folder.subfolders);
      }
    };

    collect(folders);
    return {
      hasQuery: false,
      visibleFolderIds,
      forcedExpandedFolderIds,
    };
  }

  const queryRegex = new RegExp(escapeRegExp(trimmedQuery), 'i');

  const visit = (folder: Folder): boolean => {
    const matchesFolder = queryRegex.test(folder.name);
    const matchesAlbum = folder.albums.some(
      (album) => queryRegex.test(album.name) || queryRegex.test(album.artist),
    );

    let hasVisibleDescendant = false;
    for (const subfolder of folder.subfolders) {
      if (visit(subfolder)) {
        hasVisibleDescendant = true;
      }
    }

    if (matchesFolder || matchesAlbum || hasVisibleDescendant) {
      visibleFolderIds.add(folder.id);
      if (hasVisibleDescendant) {
        forcedExpandedFolderIds.add(folder.id);
      }
      return true;
    }

    return false;
  };

  for (const folder of folders) {
    visit(folder);
  }

  return {
    hasQuery: true,
    visibleFolderIds,
    forcedExpandedFolderIds,
  };
}
