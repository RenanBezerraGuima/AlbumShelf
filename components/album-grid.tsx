'use client';

import React, { useState, useCallback } from 'react';
import { Music } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFolderStore, findFolder, getBreadcrumb } from '@/lib/store';
import { AlbumCard } from './album-card';
import type { Album } from '@/lib/types';
import { cn } from '@/lib/utils';

export function AlbumGrid() {
  // Use granular selectors to avoid re-renders when unrelated parts of the store change
  const selectedFolderId = useFolderStore(state => state.selectedFolderId);
  const selectedFolder = useFolderStore(useCallback(state =>
    state.selectedFolderId ? findFolder(state.folders, state.selectedFolderId) : null
  , []));

  const breadcrumb = useFolderStore(
    useShallow(state => state.selectedFolderId ? getBreadcrumb(state.folders, state.selectedFolderId) : [])
  );

  const reorderAlbum = useFolderStore(state => state.reorderAlbum);
  const draggedAlbumIndex = useFolderStore(state => state.draggedAlbumIndex);
  const setDraggedAlbum = useFolderStore(state => state.setDraggedAlbum);

  const [dropIndex, setDropIndex] = useState<number | null>(null);

  if (!selectedFolderId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground font-mono uppercase tracking-tighter">
        <Music className="h-16 w-16 mb-4 opacity-10" />
        <p className="text-lg font-bold">NO COLLECTION SELECTED</p>
        <p className="text-xs mt-1">Select a catalog entry to begin</p>
      </div>
    );
  }

  if (!selectedFolder) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground font-mono uppercase">
        <p>ERROR: COLLECTION NOT FOUND</p>
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent, album: Album, index: number) => {
    setDraggedAlbum(album, selectedFolderId, index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedAlbumIndex !== null && draggedAlbumIndex !== index) {
      setDropIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDropIndex(null);
  };

  const handleDrop = (index: number) => {
    if (draggedAlbumIndex !== null && draggedAlbumIndex !== index) {
      reorderAlbum(selectedFolderId, draggedAlbumIndex, index);
    }
    setDraggedAlbum(null, null, null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedAlbum(null, null, null);
    setDropIndex(null);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="h-[73px] p-4 border-b-2 border-border shrink-0 flex flex-col justify-center bg-background">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-tighter opacity-70 mb-1">
          {breadcrumb.map((name, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <span>/</span>}
              <span className={index === breadcrumb.length - 1 ? 'text-foreground font-black' : ''}>
                {name}
              </span>
            </span>
          ))}
        </div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold">
          {selectedFolder.albums.length} ALBUM{selectedFolder.albums.length !== 1 ? 'S' : ''} // CATALOG DATA
        </p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {selectedFolder.albums.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground font-mono uppercase tracking-tighter">
            <Music className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-bold">COLLECTION EMPTY</p>
            <p className="text-[10px] mt-1">Add albums via search interface</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
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
        )}
      </ScrollArea>
    </div>
  );
}
