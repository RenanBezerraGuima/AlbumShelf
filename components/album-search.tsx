'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Search, Loader2, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFolderStore } from '@/lib/store';
import type { Album, Folder } from '@/lib/types';
import { useDebounce } from '@/hooks/use-debounce';
import { searchAlbumsDeezer } from '@/lib/search-service';
import { cn } from '@/lib/utils';

export function AlbumSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = "album-search-results";
  
  const { selectedFolderId, addAlbumToFolder, removeAlbumFromFolder, folders } = useFolderStore();
  
  // Get albums in selected folder
  const albumsInSelectedFolder = useMemo(() => {
    if (!selectedFolderId) return new Map<string, string[]>();
    
    const findFolder = (folderList: Folder[]): Folder | null => {
      for (const folder of folderList) {
        if (folder.id === selectedFolderId) return folder;
        const found = findFolder(folder.subfolders);
        if (found) return found;
      }
      return null;
    };
    
    const folder = findFolder(folders);
    if (!folder) return new Map<string, string[]>();
    
    const albumMap = new Map<string, string[]>();
    folder.albums.forEach(album => {
      const key = `${album.name}-${album.artist}`.toLowerCase();
      const existing = albumMap.get(key) || [];
      albumMap.set(key, [...existing, album.id]);
    });

    return albumMap;
  }, [selectedFolderId, folders]);

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

  const searchAlbums = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await searchAlbumsDeezer(searchQuery);
      setResults(data);
      setIsOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search albums. Please try again.');
      setIsOpen(true);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const handleAddAlbum = (album: Album) => {
    if (!selectedFolderId) {
      setError('Please select a folder first');
      return;
    }

    const key = `${album.name}-${album.artist}`.toLowerCase();
    const existingIds = albumsInSelectedFolder.get(key);

    if (existingIds && existingIds.length > 0) {
      // Remove all matching albums
      existingIds.forEach(id => removeAlbumFromFolder(selectedFolderId, id));
    } else {
      addAlbumToFolder(selectedFolderId, album);
    }
  };

  return (
    <div className="w-full flex justify-center px-4 py-3 border-b border-border bg-background">
      <div className="w-full max-w-2xl relative" ref={containerRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search albums..."
            value={query}
            onChange={handleSearchChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            className="pl-9 w-full"
            maxLength={200}
            aria-label="Search albums"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-haspopup="listbox"
            aria-activedescendant={activeIndex >= 0 ? `option-${activeIndex}` : undefined}
            role="combobox"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {!selectedFolderId && query && (
          <p className="text-xs text-amber-500 mt-2 text-center">
            Select a folder to add albums
          </p>
        )}

        {isOpen && (results.length > 0 || error) && (
          <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-background border border-border rounded-lg shadow-lg overflow-hidden">
            <ScrollArea className="h-[384px]">
              <div className="p-2 space-y-1" role="listbox" id={listboxId}>
                {error && (
                  <p className="text-sm text-destructive text-center py-2">{error}</p>
                )}

                {results.map((album, index) => {
                  const isAdded = albumsInSelectedFolder.has(`${album.name}-${album.artist}`.toLowerCase());
                  const isActive = index === activeIndex;
                  
                  return (
                    <div
                      key={album.id}
                      id={`option-${index}`}
                      onClick={() => handleAddAlbum(album)}
                      role="option"
                      aria-selected={isActive}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg transition-colors",
                        selectedFolderId 
                          ? "cursor-pointer hover:bg-secondary active:bg-secondary/80" 
                          : "opacity-60 cursor-not-allowed",
                        isAdded && "bg-green-500/10",
                        isActive && "bg-accent text-accent-foreground"
                      )}
                    >
                      <img
                        src={album.imageUrl || "/placeholder.svg"}
                        alt={album.name}
                        className="w-12 h-12 rounded object-cover shrink-0 bg-muted"
                      />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="text-sm font-medium text-foreground truncate">
                          {album.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {album.artist}
                          {album.releaseDate && ` • ${album.releaseDate.slice(0, 4)}`}
                        </p>
                      </div>
                      {isAdded && (
                        <Check className="h-4 w-4 text-green-500 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
