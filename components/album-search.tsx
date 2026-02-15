'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Search, Loader2, Check, X, Menu, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useShallow } from 'zustand/react/shallow';
import { useFolderStore, findFolder } from '@/lib/store';
import type { Album } from '@/lib/types';
import { useDebounce } from '@/hooks/use-debounce';
import { searchAlbumsDeezer, searchAlbumsApple, searchAlbumsSpotify } from '@/lib/search-service';
import { cn } from '@/lib/utils';
import { redirectToSpotifyAuth } from '@/lib/spotify-auth';

interface AlbumSearchProps {
  isMobile?: boolean;
  onMenuClick?: () => void;
}

const SearchResultItem = React.memo(function SearchResultItem({
  album,
  index,
  isActive,
  isAdded,
  disabled,
  onSelect
}: {
  album: Album;
  index: number;
  isActive: boolean;
  isAdded: boolean;
  disabled: boolean;
  onSelect: (album: Album) => void;
}) {
  const label = isAdded
    ? `Remove "${album.name}" from collection`
    : `Add "${album.name}" to collection`;

  return (
    <div
      id={`option-${index}`}
      onClick={() => onSelect(album)}
      role="option"
      aria-selected={isActive}
      aria-label={label}
      title={label}
      className={cn(
        "group flex items-center gap-4 p-3 transition-all duration-100 mx-1 border border-transparent",
        !disabled
          ? "cursor-pointer hover:bg-primary hover:text-primary-foreground hover:border-border"
          : "opacity-60 cursor-not-allowed",
        isAdded && "bg-accent/20 border-accent",
        isActive && "bg-primary text-primary-foreground brutalist-shadow-sm border-border z-10"
      )}
      style={{ borderRadius: 'var(--radius)' }}
    >
      <img
        src={album.imageUrl || "/placeholder.svg"}
        alt={`${album.name} by ${album.artist}`}
        loading="lazy"
        decoding="async"
        className="w-12 h-12 border border-border object-cover shrink-0 bg-muted"
        style={{ borderRadius: 'calc(var(--radius) / 2)' }}
      />
      <div className="flex-1 min-w-0 overflow-hidden">
        <p
          className="text-sm font-bold truncate uppercase tracking-tighter"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {album.name}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-xs opacity-80 truncate uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
            {album.artist}
            {album.releaseDate && ` • ${album.releaseDate.slice(0, 4)}`}
          </p>
          <span className="text-[10px] px-1 bg-muted border border-border font-mono font-bold shrink-0">
            {album.id.split('-')[0].toUpperCase()}
          </span>
        </div>
      </div>
      <div className="relative h-4 w-4 shrink-0">
        {isAdded ? (
          <>
            <Check className="h-4 w-4 absolute inset-0 transition-opacity group-hover:opacity-0" aria-hidden="true" />
            <X className="h-4 w-4 absolute inset-0 transition-opacity opacity-0 group-hover:opacity-100" aria-hidden="true" />
          </>
        ) : (
          <Plus className="h-4 w-4 absolute inset-0 transition-opacity opacity-0 group-hover:opacity-100" aria-hidden="true" />
        )}
      </div>
    </div>
  );
});

export function AlbumSearch({ isMobile, onMenuClick }: AlbumSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = "album-search-results";

  const {
    selectedFolderId,
    streamingProvider,
    spotifyToken,
    spotifyTokenExpiry,
    spotifyTokenTimestamp
  } = useFolderStore(useShallow(state => ({
    selectedFolderId: state.selectedFolderId,
    streamingProvider: state.streamingProvider,
    spotifyToken: state.spotifyToken,
    spotifyTokenExpiry: state.spotifyTokenExpiry,
    spotifyTokenTimestamp: state.spotifyTokenTimestamp,
  })));

  const isSpotifyTokenExpired = useMemo(() => {
    if (!spotifyToken || !spotifyTokenExpiry || !spotifyTokenTimestamp) return true;
    const now = Date.now();
    return now > spotifyTokenTimestamp + (spotifyTokenExpiry * 1000);
  }, [spotifyToken, spotifyTokenExpiry, spotifyTokenTimestamp]);

  // Use a granular selector to only subscribe to the albums of the selected folder.
  // This prevents the component from re-rendering when subfolders are added or modified,
  // as the albums array reference is preserved by structural sharing in the store.
  // Performance: Return undefined when the search is closed to avoid unnecessary re-renders.
  const selectedFolderAlbums = useFolderStore(useCallback(state => {
    if (!isOpen) return undefined;
    return state.selectedFolderId ? findFolder(state.folders, state.selectedFolderId)?.albums : undefined;
  }, [isOpen]));

  // Get albums in selected folder
  // Memoized based on the specific albums array reference, leveraging structural sharing
  const albumsInSelectedFolder = useMemo(() => {
    if (!selectedFolderAlbums) return new Map<string, string[]>();

    const albumMap = new Map<string, string[]>();
    selectedFolderAlbums.forEach(album => {
      const key = `${album.name}-${album.artist}`.toLowerCase();
      const existing = albumMap.get(key) || [];
      albumMap.set(key, [...existing, album.id]);
    });

    return albumMap;
  }, [selectedFolderAlbums]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && isOpen) {
      const activeElement = document.getElementById(`option-${activeIndex}`);
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex, isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global shortcut and custom events for search (/)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInputActive = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');

      if (e.key === '/' && !isInputActive && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    const handleFocusSearch = () => {
      inputRef.current?.focus();
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('albumshelf:focus-search', handleFocusSearch);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('albumshelf:focus-search', handleFocusSearch);
    };
  }, []);

  const searchAlbums = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let data: Album[] = [];
      if (streamingProvider === 'apple') {
        data = await searchAlbumsApple(searchQuery);
      } else if (streamingProvider === 'deezer') {
        data = await searchAlbumsDeezer(searchQuery);
      } else if (streamingProvider === 'spotify') {
        if (isSpotifyTokenExpired) {
          setError('Spotify session expired or not connected.');
          setResults([]);
          setIsOpen(true);
          return;
        }
        data = await searchAlbumsSpotify(searchQuery, spotifyToken);
      }
      setResults(data);
      setIsOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search albums. Please try again.');
      setIsOpen(true);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [streamingProvider, isSpotifyTokenExpired, spotifyToken]);

  const debouncedSearch = useDebounce(searchAlbums, 150);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  const handleFocus = () => {
    if (results.length > 0 || error) {
      setIsOpen(true);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleAddAlbum(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleAddAlbum = useCallback((album: Album) => {
    const { selectedFolderId, folders, addAlbumToFolder, removeAlbumFromFolder } = useFolderStore.getState();

    if (!selectedFolderId) {
      setError('Please select a folder first');
      return;
    }

    const folder = findFolder(folders, selectedFolderId);
    if (!folder) return;

    const key = `${album.name}-${album.artist}`.toLowerCase();
    const existingAlbums = folder.albums.filter(a =>
      `${a.name}-${a.artist}`.toLowerCase() === key
    );

    if (existingAlbums.length > 0) {
      // Remove all matching albums
      existingAlbums.forEach(a => removeAlbumFromFolder(selectedFolderId, a.id));
    } else {
      addAlbumToFolder(selectedFolderId, album);
    }
  }, []); // Stable handler reference

  return (
    <div
      className={cn(
        "w-full flex flex-col items-center bg-background z-50",
        isMobile ? "px-2 py-4 border-t-2 border-border pb-safe" : "px-4 py-6 border-b-2 border-border"
      )}
    >
      <div
        className="w-full max-w-2xl flex flex-nowrap items-center gap-3 relative"
        ref={containerRef}
      >
        <div className="relative group flex-1 min-w-0" data-testid="search-input-wrapper">
          <Search
            data-testid="search-icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors"
          />
          <Input
            ref={inputRef}
            placeholder={isMobile ? "SEARCH..." : `SEARCH ON ${streamingProvider.toUpperCase()} [/]...`}
            value={query}
            onChange={handleSearchChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            className={cn(
              "pl-12 pr-26 h-12 w-full bg-background border-2 border-border focus:ring-0 focus:border-primary focus:brutalist-shadow transition-all uppercase tracking-tighter",
              isMobile ? "text-base" : "text-lg"
            )}
            style={{ borderRadius: 'var(--radius)', fontFamily: 'var(--font-mono)' }}
            maxLength={200}
            aria-label="Search albums"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-haspopup="listbox"
            aria-activedescendant={activeIndex >= 0 ? `option-${activeIndex}` : undefined}
            role="combobox"
          />
          {query.length > 0 && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2 text-[9px] font-mono text-muted-foreground opacity-50 uppercase tracking-widest animate-in fade-in duration-300 select-none pointer-events-none">
              {query.length}/{200}
            </div>
          )}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : query ? (
              <button
                onClick={clearSearch}
                className="p-1 hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary outline-none"
                aria-label="Clear search"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
        {isOpen && (results.length > 0 || error || (query.trim() && !isLoading)) && (
          <div
            className={cn(
              "absolute left-0 right-0 z-50 glass border-2 border-border brutalist-shadow overflow-hidden animate-in fade-in duration-200",
              isMobile ? "bottom-full mb-4 slide-in-from-bottom-2" : "top-full mt-2 slide-in-from-top-2"
            )}
            style={{ borderRadius: 'var(--radius)' }}
          >
            <ScrollArea className="h-[400px]">
              <div className="p-2 space-y-1" role="listbox" id={listboxId}>
                {results.length > 0 && (
                  <div className="px-3 py-1.5 mb-1 border-b border-border/50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70" style={{ fontFamily: 'var(--font-mono)' }}>
                      {results.length} RESULTS FOUND
                    </p>
                  </div>
                )}
                {error && (
                  <div className="py-6 px-4 text-center space-y-4">
                    <p className="text-sm text-destructive uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
                      {error}
                    </p>
                    {streamingProvider === 'spotify' && isSpotifyTokenExpired && (
                      <button
                        onClick={() => redirectToSpotifyAuth()}
                        className="inline-block bg-[#1DB954] text-white px-6 py-2 font-black uppercase tracking-tighter hover:brutalist-shadow transition-all cursor-pointer"
                      >
                        Connect Spotify
                      </button>
                    )}
                  </div>
                )}

                {results.length === 0 && !error && query.trim() && !isLoading && (
                  <div className="py-8 px-4 text-center">
                    <p className="text-sm text-muted-foreground uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
                      No albums found for "{query}"
                    </p>
                  </div>
                )}

                {results.map((album, index) => (
                  <SearchResultItem
                    key={album.id}
                    album={album}
                    index={index}
                    isActive={index === activeIndex}
                    isAdded={albumsInSelectedFolder.has(`${album.name}-${album.artist}`.toLowerCase())}
                    disabled={!selectedFolderId}
                    onSelect={handleAddAlbum}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {!selectedFolderId && query && (
        <p className="text-xs text-primary font-mono mt-2 text-center uppercase tracking-tighter">
          Select a collection to add albums
        </p>
      )}
    </div>
  );
}
