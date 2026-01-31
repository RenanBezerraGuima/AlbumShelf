'use client';

import React from "react";
import { useState } from 'react';
import { Play, GripVertical, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFolderStore } from '@/lib/store';
import type { Album } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AlbumCardProps {
  album: Album;
  folderId: string;
}

export const AlbumCard = React.memo(function AlbumCard({ album, folderId }: AlbumCardProps) {
  const [deezerUrl, setDeezerUrl] = useState<string | null>(null);
  const [isLoadingDeezer, setIsLoadingDeezer] = useState(false);

  const removeAlbumFromFolder = useFolderStore(state => state.removeAlbumFromFolder);

  const handleRemove = () => {
    removeAlbumFromFolder(folderId, album.id);
  };

  const handleOpenDeezer = () => {
    if (album.externalUrl) {
      window.open(album.externalUrl, '_blank');
    } else {
      const searchQuery = `${album.name} ${album.artist}`;
      window.open(
        `https://www.deezer.com/search/${encodeURIComponent(searchQuery)}`,
        '_blank'
      );
    }
  };

  return (
    <div
      className={cn(
        'group relative bg-card rounded-lg overflow-hidden border border-border shadow-sm transition-all hover:shadow-md hover:border-muted-foreground/30'
      )}
    >
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10">
        <div className="bg-background/80 backdrop-blur-sm rounded p-1">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <Button
          size="icon"
          variant="destructive"
          className="h-7 w-7"
          onClick={handleRemove}
          aria-label="Remove album"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="aspect-square relative">
        <img
          src={album.imageUrl || "/placeholder.svg"}
          alt={album.name}
          className="w-full h-full object-cover"
        />
        
        <button
          onClick={handleOpenDeezer}
          disabled={isLoadingDeezer}
          aria-label="Open on Deezer"
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          {isLoadingDeezer ? (
            <Loader2 className="h-12 w-12 text-white animate-spin" />
          ) : (
            <div className="bg-[#A238FF] rounded-full p-3 shadow-lg hover:scale-110 transition-transform">
              <Play className="h-8 w-8 text-white fill-white" />
            </div>
          )}
        </button>
      </div>

      <div className="p-3">
        <h3 className="font-medium text-sm text-foreground truncate" title={album.name}>
          {album.name}
        </h3>
        <p className="text-xs text-muted-foreground truncate mt-0.5" title={album.artist}>
          {album.artist}
        </p>
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          {album.releaseDate && (
            <>
              <span>{album.releaseDate.split('-')[0]}</span>
              <span>-</span>
            </>
          )}
          <span>{album.totalTracks} tracks</span>
        </div>
      </div>
    </div>
  );
});
