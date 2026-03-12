import type { Folder, Album } from './types';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface FolderSearchState {
  hasQuery: boolean;
  visibleFolderIds: Set<string>;
  forcedExpandedFolderIds: Set<string>;
}

// Performance: Shared empty set to maintain reference stability across re-renders
// when no search query is active. This allows React.memo components to skip reconciliation.
const EMPTY_SET = new Set<string>();

// Performance: Cache for concatenated album names and artists to avoid O(N) string operations
// during every search keystroke. We key this by the 'albums' array reference
// rather than the Folder object itself, so the cache persists across folder renames.
const searchContentCache = new WeakMap<Album[], string>();

function getFolderSearchContent(folder: Folder): string {
  let content = searchContentCache.get(folder.albums);
  if (content === undefined) {
    // We use a null character as a separator to prevent queries from matching
    // across different albums or across the name/artist boundary incorrectly,
    // while still allowing a single fast RegExp.test() call for the entire folder.
    content = folder.albums.map(a => `${a.name}\0${a.artist}`).join('\0');
    searchContentCache.set(folder.albums, content);
  }
  return content;
}

export function getFolderSearchState(
  folders: Folder[],
  query: string,
): FolderSearchState {
  const trimmedQuery = query.trim();

  // Performance: Return early with stable empty sets if the query is empty.
  // The UI (FolderTree) handles the empty query state by showing all folders.
  // Using EMPTY_SET ensures that FolderItem components (React.memo) skip
  // redundant re-renders when the store updates but search is inactive.
  if (!trimmedQuery) {
    return {
      hasQuery: false,
      visibleFolderIds: EMPTY_SET,
      forcedExpandedFolderIds: EMPTY_SET,
    };
  }

  const visibleFolderIds = new Set<string>();
  const forcedExpandedFolderIds = new Set<string>();

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
