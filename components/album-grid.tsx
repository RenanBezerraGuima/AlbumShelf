'use client';

import React, { useState, useCallback } from 'react';
import { Music, Grid2X2, Orbit, Search } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFolderStore, findFolder, getBreadcrumb } from '@/lib/store';
import { AlbumCard } from './album-card';
import { AlbumCanvas } from './album-canvas';
import type { Album } from '@/lib/types';
import { cn } from '@/lib/utils';

export function AlbumGrid({ isMobile }: { isMobile?: boolean }) {
  // Use granular selectors to avoid re-renders when unrelated parts of the store change
  const selectedFolderId = useFolderStore(state => state.selectedFolderId);
  const selectedFolder = useFolderStore(useCallback(state =>
    state.selectedFolderId ? findFolder(state.folders, state.selectedFolderId) : null
  , []));

  const breadcrumb = useFolderStore(
    useShallow(state => state.selectedFolderId ? getBreadcrumb(state.folders, state.selectedFolderId) : [])
  );

  const draggedAlbumIndex = useFolderStore(state => state.draggedAlbumIndex);
  const setFolderViewMode = useFolderStore(state => state.setFolderViewMode);

  const albumViewMode = selectedFolder?.viewMode || 'grid';
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  if (!selectedFolderId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground uppercase tracking-tighter" style={{ fontFamily: 'var(--font-body)' }}>
        <Music className="h-16 w-16 mb-4 opacity-10" />
        <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>NO COLLECTION SELECTED</p>
        <p className="text-xs mt-1" style={{ fontFamily: 'var(--font-mono)' }}>Select a catalog entry to begin</p>
      </div>
    );
  }

  if (!selectedFolder) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
        <p>ERROR: COLLECTION NOT FOUND</p>
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent, album: Album, index: number) => {
    useFolderStore.getState().setDraggedAlbum(album, selectedFolderId, index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    // Optimization: Only update state if the drop target has actually changed.
    // This prevents redundant re-renders during high-frequency dragOver events.
    if (draggedAlbumIndex !== null && draggedAlbumIndex !== index && dropIndex !== index) {
      setDropIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDropIndex(null);
  };

  const handleDrop = (index: number) => {
    const { reorderAlbum, setDraggedAlbum } = useFolderStore.getState();
    if (draggedAlbumIndex !== null && draggedAlbumIndex !== index) {
      reorderAlbum(selectedFolderId, draggedAlbumIndex, index);
    }
    setDraggedAlbum(null, null, null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    useFolderStore.getState().setDraggedAlbum(null, null, null);
    setDropIndex(null);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className={cn(
        "h-[73px] border-b-2 border-border shrink-0 flex flex-col justify-center bg-background",
        isMobile ? "p-3" : "p-4"
      )}>
        <div className={cn(
          'flex items-center justify-between gap-2 uppercase tracking-tighter opacity-70 mb-1',
          isMobile ? 'text-[9px]' : 'text-[10px]'
        )} style={{ fontFamily: 'var(--font-mono)' }}>
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            {breadcrumb.map((name, index) => (
              <span key={index} className="flex items-center gap-2 shrink-0">
                {index > 0 && <span>/</span>}
                <span className={index === breadcrumb.length - 1 ? 'text-foreground font-black' : ''}>
                  {name}
                </span>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFolderViewMode(selectedFolderId, 'grid')}
              className={cn('border border-border px-2 py-0.5', albumViewMode === 'grid' && 'bg-primary text-primary-foreground')}
              aria-label="Switch to grid view"
              title="Grid view"
            >
              <Grid2X2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setFolderViewMode(selectedFolderId, 'canvas')}
              className={cn('border border-border px-2 py-0.5', albumViewMode === 'canvas' && 'bg-primary text-primary-foreground')}
              aria-label="Switch to canvas view"
              title="Canvas view"
            >
              <Orbit className="h-3 w-3" />
            </button>
          </div>
        </div>
        <p className="text-[10px] uppercase tracking-widest text-primary font-bold" style={{ fontFamily: 'var(--font-body)' }}>
          {selectedFolder.albums.length} ALBUM{selectedFolder.albums.length !== 1 ? 'S' : ''} // CATALOG DATA
        </p>
      </div>

      {selectedFolder.albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground uppercase tracking-tighter" style={{ fontFamily: 'var(--font-body)' }}>
          <Music className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>COLLECTION EMPTY</p>
          <p className="text-[10px] mt-1 mb-4" style={{ fontFamily: 'var(--font-mono)' }}>Add albums via search interface</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('albumshelf:focus-search'))}
            className="gap-2 rounded-none border-2 border-dashed border-muted-foreground/50 hover:border-primary hover:text-primary transition-all uppercase tracking-tighter font-bold h-auto py-3 px-4"
          >
            <Search className="h-4 w-4" />
            Find your first album
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
              <div
                key={album.id}
                draggable
                onDragStart={(e) => handleDragStart(e, album, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'transition-all',
                  draggedAlbumIndex === index && 'opacity-50',
                  dropIndex === index && 'ring-2 ring-primary ring-offset-2 rounded-none'
                )}
              >
                <AlbumCard album={album} folderId={selectedFolderId} />
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
