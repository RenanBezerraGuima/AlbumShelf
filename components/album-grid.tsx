'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Music, Grid2X2, Orbit, Search } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFolderStore, findFolder, getBreadcrumb } from '@/lib/store';
import { AlbumCard } from './album-card';
import { AlbumCanvas } from './album-canvas';
import type { Album } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Performance: Memoized item wrapper for the grid.
 * By using granular boolean props like 'isDragged' and 'isDropTarget' instead of
 * passing the raw indexes, we allow React to skip reconciliation for 99% of items
 * when the drop target changes during a drag operation.
 */
const DraggableAlbumItem = React.memo(function DraggableAlbumItem({
  album,
  index,
  folderId,
  isDragged,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  album: Album;
  index: number;
  folderId: string;
  isDragged: boolean;
  isDropTarget: boolean;
  onDragStart: (e: React.DragEvent, album: Album, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: () => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, album, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={() => onDrop(index)}
      onDragEnd={onDragEnd}
      className={cn(
        'transition-all',
        isDragged && 'opacity-50',
        isDropTarget && 'ring-2 ring-primary ring-offset-2 rounded-none'
      )}
    >
      <AlbumCard album={album} folderId={folderId} />
    </div>
  );
});

export function AlbumGrid({ isMobile }: { isMobile?: boolean }) {
  // Use granular selectors to avoid re-renders when unrelated parts of the store change
  const selectedFolderId = useFolderStore(state => state.selectedFolderId);
  const selectedFolder = useFolderStore(useCallback(state =>
    state.selectedFolderId ? findFolder(state.sharedFolders ?? state.folders, state.selectedFolderId) : null
  , []));

  const breadcrumb = useFolderStore(
    useShallow(state => state.selectedFolderId ? getBreadcrumb(state.sharedFolders ?? state.folders, state.selectedFolderId) : [])
  );

  const draggedAlbumIndex = useFolderStore(state => state.draggedAlbumIndex);
  const setFolderViewMode = useFolderStore(state => state.setFolderViewMode);

  const albumViewMode = selectedFolder?.viewMode || 'grid';
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputActive = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');
      const isContentEditable = (document.activeElement as HTMLElement)?.isContentEditable;

      if (!isInputActive && !isContentEditable && !e.metaKey && !e.ctrlKey && !e.altKey && selectedFolderId) {
        if (e.key.toLowerCase() === 'g') {
          e.preventDefault();
          useFolderStore.getState().setFolderViewMode(selectedFolderId, 'grid');
        } else if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          useFolderStore.getState().setFolderViewMode(selectedFolderId, 'canvas');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFolderId]);

  // Performance: Handlers are stabilized with useCallback and use getState()
  // for store data to prevent re-rendering memoized DraggableAlbumItems.
  const handleDragStart = useCallback((e: React.DragEvent, album: Album, index: number) => {
    const { selectedFolderId, setDraggedAlbum } = useFolderStore.getState();
    if (!selectedFolderId) return;
    setDraggedAlbum(album, selectedFolderId, index);
    e.dataTransfer.setData('text/plain', album.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    const { draggedAlbumIndex } = useFolderStore.getState();
    // Optimization: Only update state if the drop target has actually changed.
    // This prevents redundant re-renders during high-frequency dragOver events.
    if (draggedAlbumIndex !== null && draggedAlbumIndex !== index) {
      setDropIndex(prev => prev !== index ? index : prev);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropIndex(null);
  }, []);

  const handleDrop = useCallback((index: number) => {
    const { selectedFolderId, draggedAlbumIndex, reorderAlbum, setDraggedAlbum } = useFolderStore.getState();
    if (selectedFolderId && draggedAlbumIndex !== null && draggedAlbumIndex !== index) {
      reorderAlbum(selectedFolderId, draggedAlbumIndex, index);
    }
    setDraggedAlbum(null, null, null);
    setDropIndex(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    useFolderStore.getState().setDraggedAlbum(null, null, null);
    setDropIndex(null);
  }, []);

  if (!selectedFolderId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground tracking-tighter" style={{ fontFamily: 'var(--font-body)' }}>
        <Music className="h-16 w-16 mb-4 opacity-10" />
        <p className="text-lg font-medium" style={{ fontFamily: 'var(--font-display)' }}>No collection selected</p>
        <p className="text-xs mt-1" style={{ fontFamily: 'var(--font-mono)' }}>Select a catalog entry to begin</p>
      </div>
    );
  }

  if (!selectedFolder) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
        <p>Error: Collection not found</p>
      </div>
    );
  }

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-col h-full bg-background outline-none">
      <div className={cn(
        "h-[73px] border-b-2 border-border shrink-0 flex flex-col justify-center bg-background",
        isMobile ? "p-3" : "p-4"
      )}>
        <div className={cn(
          'flex items-center justify-between gap-2 tracking-tighter opacity-70 mb-1',
          isMobile ? 'text-[9px]' : 'text-[10px]'
        )} style={{ fontFamily: 'var(--font-mono)' }}>
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            {breadcrumb.map((item, index) => (
              <span key={item.id} className="flex items-center gap-2 shrink-0">
                {index > 0 && <span aria-hidden="true" className="opacity-40">/</span>}
                {index === breadcrumb.length - 1 ? (
                  <span className="text-foreground font-semibold truncate" aria-current="page">
                    {item.name}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => useFolderStore.getState().setSelectedFolder(item.id)}
                    className="hover:text-primary hover:underline transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary px-0.5 rounded-sm cursor-pointer"
                    aria-label={`Go back to ${item.name}`}
                    title={`Go back to ${item.name}`}
                  >
                    {item.name}
                  </button>
                )}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFolderViewMode(selectedFolderId, 'grid')}
              className={cn('border border-border px-2 py-0.5', albumViewMode === 'grid' && 'bg-primary text-primary-foreground')}
              aria-label="Switch to grid view [G]"
              title="Grid view [G]"
              aria-keyshortcuts="g"
            >
              <Grid2X2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setFolderViewMode(selectedFolderId, 'canvas')}
              className={cn('border border-border px-2 py-0.5', albumViewMode === 'canvas' && 'bg-primary text-primary-foreground')}
              aria-label="Switch to canvas view [V]"
              title="Canvas view [V]"
              aria-keyshortcuts="v"
            >
              <Orbit className="h-3 w-3" />
            </button>
          </div>
        </div>
        <p className="text-[10px] tracking-widest text-primary font-medium" style={{ fontFamily: 'var(--font-body)' }}>
          {selectedFolder.albums.length} album{selectedFolder.albums.length !== 1 ? 's' : ''} // Catalog data
        </p>
      </div>

      {selectedFolder.albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground tracking-tighter" style={{ fontFamily: 'var(--font-body)' }}>
          <Music className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium" style={{ fontFamily: 'var(--font-display)' }}>Collection empty</p>
          <p className="text-[10px] mt-1 mb-4" style={{ fontFamily: 'var(--font-mono)' }}>Add albums via search interface</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('albumshelf:focus-search'))}
            className="gap-2 rounded-none border-2 border-dashed border-muted-foreground/50 hover:border-primary hover:text-primary transition-all tracking-tighter font-medium h-auto py-3 px-4"
            title="Find your first album [/]"
            aria-label="Find your first album [/]"
            aria-keyshortcuts="/"
          >
            <Search className="h-4 w-4" />
            Find your first album [/]
          </Button>
        </div>
      ) : albumViewMode === 'canvas' ? (
        <AlbumCanvas albums={selectedFolder.albums} folderId={selectedFolderId} />
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className={cn(
            'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
            isMobile ? 'gap-2 p-2' : 'gap-4 p-4'
          )}>
            {selectedFolder.albums.map((album, index) => (
              <DraggableAlbumItem
                key={album.id}
                album={album}
                index={index}
                folderId={selectedFolderId}
                isDragged={draggedAlbumIndex === index}
                isDropTarget={dropIndex === index}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
