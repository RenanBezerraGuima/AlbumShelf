'use client';

import React, { useState } from 'react';
import { Music } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFolderStore } from '@/lib/store';
import { AlbumCard } from './album-card';
import type { Folder, Album } from '@/lib/types';
import { cn } from '@/lib/utils';

function findFolder(folders: Folder[], id: string): Folder | null {
  for (const folder of folders) {
    if (folder.id === id) return folder;
    const found = findFolder(folder.subfolders, id);
    if (found) return found;
  }
  return null;
}

function getBreadcrumb(folders: Folder[], targetId: string): string[] {
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
}

export function AlbumGrid() {
  const folders = useFolderStore(state => state.folders);
  const selectedFolderId = useFolderStore(state => state.selectedFolderId);
  const reorderAlbum = useFolderStore(state => state.reorderAlbum);
  const draggedAlbumIndex = useFolderStore(state => state.draggedAlbumIndex);
  const draggedAlbum = useFolderStore(state => state.draggedAlbum);
  const setDraggedAlbum = useFolderStore(state => state.setDraggedAlbum);

  const [dropIndex, setDropIndex] = useState<number | null>(null);

  if (!selectedFolderId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Music className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg">Select a folder to view albums</p>
        <p className="text-sm mt-1">Or create a new folder to get started</p>
      </div>
    );
  }

  const selectedFolder = findFolder(folders, selectedFolderId);

  if (!selectedFolder) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Folder not found</p>
      </div>
    );
  }

  const breadcrumb = getBreadcrumb(folders, selectedFolderId);

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
    <div className="flex flex-col h-full">
      <div className="h-[73px] p-4 border-b border-border shrink-0 flex flex-col justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          {breadcrumb.map((name, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <span>/</span>}
              <span className={index === breadcrumb.length - 1 ? 'text-foreground font-medium' : ''}>
                {name}
              </span>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {selectedFolder.albums.length} album{selectedFolder.albums.length !== 1 ? 's' : ''}
        </p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {selectedFolder.albums.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Music className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">No albums in this folder</p>
            <p className="text-xs mt-1">Search and add albums from the top</p>
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
                  dropIndex === index && 'ring-2 ring-primary ring-offset-2 rounded-lg'
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
