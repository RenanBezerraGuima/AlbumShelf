import type { Folder, Album } from './types';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface FolderSearchState {
  hasQuery: boolean;
  visibleFolderIds: Set<string>;
  forcedExpandedFolderIds: Set<string>;
}

// Performance: Constants for empty search state to provide referential stability.
// This allows consumer components (e.g., FolderItem) to skip reconciliation
// when search is inactive.
const EMPTY_SET = new Set<string>();
const EMPTY_STATE: FolderSearchState = {
  hasQuery: false,
  visibleFolderIds: EMPTY_SET,
  forcedExpandedFolderIds: EMPTY_SET,
};

// Performance: Cache for concatenated album names and artists to avoid O(N) string operations
// during every search keystroke. Since the albums array reference is stable in the store
// across folder renames or metadata updates (due to structural sharing),
// using it as the key ensures the cache remains valid even if the Folder object changes.
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

  // Performance: Return a stable EMPTY_STATE if the query is empty.
  // The UI (FolderTree) handles the empty query state by showing all folders.
  // Using EMPTY_SET (via EMPTY_STATE) ensures that FolderItem components (React.memo)
  // skip redundant re-renders when the store updates but search is inactive.
  if (!trimmedQuery) {
    return EMPTY_STATE;
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
