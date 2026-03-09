import type { Folder } from './types';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface FolderSearchState {
  hasQuery: boolean;
  visibleFolderIds: Set<string>;
  forcedExpandedFolderIds: Set<string>;
}

// Performance: Cache for concatenated album names and artists to avoid O(N) string operations
// during every search keystroke. Since folders are immutable in the store,
// we can use their references as keys in a WeakMap.
const searchContentCache = new WeakMap<Folder, string>();

function getFolderSearchContent(folder: Folder): string {
  let content = searchContentCache.get(folder);
  if (content === undefined) {
    // We use a null character as a separator to prevent queries from matching
    // across different albums or across the name/artist boundary incorrectly,
    // while still allowing a single fast RegExp.test() call for the entire folder.
    content = folder.albums.map(a => `${a.name}\0${a.artist}`).join('\0');
    searchContentCache.set(folder, content);
  }
  return content;
}

export function getFolderSearchState(
  folders: Folder[],
  query: string,
): FolderSearchState {
  const trimmedQuery = query.trim();
  const visibleFolderIds = new Set<string>();
  const forcedExpandedFolderIds = new Set<string>();

  // Performance: Return early with empty sets if the query is empty.
  // The UI (FolderTree) handles the empty query state by showing all folders.
  // This avoids an O(N) tree traversal on every re-render when not searching.
  if (!trimmedQuery) {
    return {
      hasQuery: false,
      visibleFolderIds,
      forcedExpandedFolderIds,
    };
  }

  const queryRegex = new RegExp(escapeRegExp(trimmedQuery), 'i');

  const visit = (folder: Folder): boolean => {
    // Performance: Reorder checks to short-circuit as early as possible.
    // 1. Check folder name (cheap)
    const matchesFolder = queryRegex.test(folder.name);

    // 2. Check subfolders (recursive, but potentially allows skipping album search)
    let hasVisibleDescendant = false;
    for (const subfolder of folder.subfolders) {
      if (visit(subfolder)) {
        hasVisibleDescendant = true;
      }
    }

    // 3. Check albums (expensive, only if needed)
    // We only need to check albums if the folder name and descendants didn't match.
    const matchesAlbum = (!matchesFolder && !hasVisibleDescendant)
      ? queryRegex.test(getFolderSearchContent(folder))
      : false;

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
