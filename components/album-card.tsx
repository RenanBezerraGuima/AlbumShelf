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
  const handleRemove = () => {
    useFolderStore.getState().removeAlbumFromFolder(folderId, album.id);
  };

  const handlePlay = () => {
    if (album.externalUrl) {
      window.open(album.externalUrl, '_blank');
    } else {
      const { streamingProvider } = useFolderStore.getState();
      const searchQuery = `${album.name} ${album.artist}`;
      const url = streamingProvider === 'apple'
        ? `https://music.apple.com/search?term=${encodeURIComponent(searchQuery)}`
        : `https://www.deezer.com/search/${encodeURIComponent(searchQuery)}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div
      className={cn(
        'group relative bg-card rounded-none overflow-hidden border-2 border-border transition-all duration-200 hover:brutalist-shadow hover:-translate-x-1 hover:-translate-y-1 active:translate-x-0 active:translate-y-0'
      )}
    >
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10">
        <div className="bg-background border border-border p-1">
          <GripVertical className="h-4 w-4 text-foreground" />
        </div>
      </div>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <Button
          size="icon"
          variant="destructive"
          className="h-7 w-7 rounded-none border-2 border-border brutalist-shadow-sm"
          onClick={handleRemove}
          aria-label="Remove album"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="aspect-square relative border-b-2 border-border overflow-hidden">
        <img
          src={album.imageUrl || "/placeholder.svg"}
          alt={album.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        
        <button
          onClick={handlePlay}
          aria-label="Play album"
          className="absolute inset-0 flex items-center justify-center bg-primary/20 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
        >
          <div className="bg-primary text-primary-foreground border-2 border-border p-4 brutalist-shadow hover:scale-110 transition-transform duration-200">
            <Play className="h-8 w-8 fill-current" />
          </div>
        </button>
      </div>

      <div className="p-3 bg-card font-mono uppercase tracking-tighter">
        <h3 className="font-black text-sm text-foreground truncate" title={album.name}>
          {album.name}
        </h3>
        <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={album.artist}>
          {album.artist}
        </p>
        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
          <span className="bg-foreground text-background px-1 font-bold">
            {album.id.split('-')[0].toUpperCase()}
          </span>
          <span>|</span>
          {album.releaseDate && (
            <>
              <span>{album.releaseDate.split('-')[0]}</span>
              <span>|</span>
            </>
          )}
          <span>{album.totalTracks} TRACKS</span>
        </div>
      </div>
    </div>
  );
});
