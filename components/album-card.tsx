'use client';

import React, { useEffect, useState, useCallback } from "react";
import { Play, Pause, Trash2, Copy, ExternalLink, Music, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useFolderStore } from '@/lib/store';
import type { Album, AlbumDetails } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getAlbumDetailsDeezer } from '@/lib/search-service';
import { audioManager } from '@/lib/audio-store';

interface AlbumCardProps {
  album: Album;
  folderId: string;
}

/**
 * Performance: Separate component for the provider-specific menu item.
 * By moving the 'streamingProvider' subscription here, we ensure that
 * changes to the global provider setting only re-render this specific menu item
 * (and only when the context menu is actually open), instead of re-rendering
 * all 1000s of AlbumCard instances in the grid.
 */
const OpenInProviderMenuItem = React.memo(function OpenInProviderMenuItem({
  onPlay,
}: {
  onPlay: (e: React.MouseEvent) => void;
}) {
  const streamingProvider =
    useFolderStore((state) => state.streamingProvider) || 'deezer';
  return (
    <ContextMenuItem onClick={onPlay}>
      <ExternalLink className="mr-2 h-4 w-4" />
      Open in {streamingProvider.toUpperCase()}
    </ContextMenuItem>
  );
});

/**
 * Performance: Separate component for the track list and audio state.
 * By moving the 'audioManager' subscription here, we ensure that
 * only flipped albums with active tracklists re-render during playback.
 * This reduces re-renders from O(N) to O(Flipped).
 */
const TrackList = React.memo(function TrackList({
  details,
}: {
  details: AlbumDetails;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackUrl, setCurrentTrackUrl] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = audioManager.subscribe((playing, url) => {
      setIsPlaying(playing);
      setCurrentTrackUrl(url);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFlipped) {
        setIsFlipped(false);
        audioManager.stop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped]);

  const handleFlip = async (e?: React.MouseEvent) => {
    if (!isFlipped && !details) {
      setIsLoadingDetails(true);
      try {
        const data = await getAlbumDetailsDeezer(album.id);
        setDetails(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingDetails(false);
      }
    }

    if (isFlipped) {
      audioManager.stop();
    }

    setIsFlipped(!isFlipped);
  };

  const handleRemove = () => {
    useFolderStore.getState().removeAlbumFromFolder(folderId, album.id);
    setIsDeleteDialogOpen(false);
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (album.externalUrl) {
      window.open(album.externalUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Performance: Accessing provider via getState() inside the handler
      // avoids a reactive subscription in the main component.
      const { streamingProvider } = useFolderStore.getState();
      const searchQuery = `${album.name} ${album.artist}`;
      const url = streamingProvider === 'apple'
        ? `https://music.apple.com/search?term=${encodeURIComponent(searchQuery)}`
        : `https://www.deezer.com/search/${encodeURIComponent(searchQuery)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const copyDetails = useCallback(() => {
    navigator.clipboard.writeText(`${album.artist} - ${album.name}`);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [album.artist, album.name]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'group relative aspect-square perspective-1000 transition-all duration-200 hover:brutalist-shadow hover:-translate-x-1 hover:-translate-y-1 active:translate-x-0 active:translate-y-0 focus-within:brutalist-shadow focus-within:-translate-x-1 focus-within:-translate-y-1 cursor-pointer',
            isFlipped ? 'z-50' : 'z-0'
          )}
          style={{ borderRadius: 'var(--radius)' }}
          onClick={(e) => {
            // Check if the click target is a button or inside a button
            if ((e.target as HTMLElement).closest('button')) {
              return;
            }
            handleFlip(e);
          }}
        >
          <div className={cn(
            "relative w-full h-full transition-transform duration-700 preserve-3d cursor-pointer",
            isFlipped && "rotate-y-180"
          )}>
            {/* Front Side */}
            <div
              className={cn(
                'absolute inset-0 bg-card overflow-hidden border-2 border-border backface-hidden'
              )}
              style={{ borderRadius: 'var(--radius)' }}
            >
      <div className="absolute top-2 right-2 opacity-40 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10">
        <Button
          size="icon"
          variant="destructive"
          className="h-7 w-7 border-2 border-border brutalist-shadow-sm"
          style={{ borderRadius: 'var(--radius)' }}
          onClick={(e) => {
            e.stopPropagation();
            setIsDeleteDialogOpen(true);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Remove album"
          title="Remove album"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Album</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove "{album.name}" from this collection?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="rounded-none border-2 border-transparent hover:border-border"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              className="rounded-none brutalist-shadow-sm"
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="aspect-square relative border-b-2 border-border overflow-hidden">
        <img
          src={album.imageUrl || "/placeholder.svg"}
          alt={`${album.name} by ${album.artist}`}
          draggable="false"
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        
        <Button
          size="icon-sm"
          className="absolute bottom-2 right-2 opacity-40 group-hover:opacity-100 focus-visible:opacity-100 transition-all duration-200 z-10 border-2 border-border brutalist-shadow-sm"
          style={{ borderRadius: 'var(--radius)' }}
          onClick={handlePlay}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Play album"
          title="Play album"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
        </Button>
      </div>

      <div className="p-3 bg-card tracking-tighter" style={{ fontFamily: 'var(--font-body)' }}>
        <h3 className="font-medium text-sm text-foreground truncate" title={album.name} style={{ fontFamily: 'var(--font-display)' }}>
          {album.name}
        </h3>
        <p
          className={cn(
            "text-[10px] truncate mt-0.5 transition-colors duration-300 cursor-pointer hover:text-primary",
            isCopied ? "text-primary font-bold" : "text-muted-foreground"
          )}
          title={`${album.artist} [Click to copy]`}
          onClick={copyDetails}
        >
          {isCopied ? "Copied to clipboard!" : album.artist}
        </p>
        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
          <span className="bg-foreground text-background px-1 font-medium">
            {album.id.split('-')[0].toUpperCase()}
          </span>
          <span>|</span>
          {album.releaseDate && (
            <>
              <span>{album.releaseDate.split('-')[0]}</span>
              <span>|</span>
            </>
          )}
          <span>{album.totalTracks} tracks</span>
        </div>
      </div>
            </div>

            {/* Back Side */}
            <div
              className={cn(
                'absolute top-0 left-0 right-0 bg-card border-2 border-border backface-hidden rotate-y-180 flex flex-col transition-[height,box-shadow] duration-300',
                isFlipped ? 'h-fit min-h-full max-h-[400px] brutalist-shadow z-50' : 'h-full overflow-hidden'
              )}
              style={{ borderRadius: 'var(--radius)' }}
            >
              <div className="p-3 border-b-2 border-border bg-muted/20 flex items-center justify-between">
                <div className="min-w-0">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest truncate">{album.name}</h4>
                  <p className="text-[8px] text-muted-foreground truncate">{album.artist}</p>
                </div>
                <Info className="h-3 w-3 text-muted-foreground shrink-0" />
              </div>

              <div className={cn(
                "p-1 custom-scrollbar",
                isFlipped ? "overflow-y-auto max-h-[320px]" : "flex-1 overflow-y-auto"
              )}>
                {isLoadingDetails ? (
                  <div className="space-y-2 p-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="h-3 w-3 bg-muted animate-pulse shrink-0" />
                        <div className="h-3 flex-1 bg-muted animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : details ? (
                  <TrackList details={details} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                    <Music className="h-8 w-8 text-muted/30 mb-2" />
                    <p className="text-[10px] text-muted-foreground">Tracklist not available for this provider yet.</p>
                  </div>
                )}
              </div>

              <div className="p-2 border-t-2 border-border bg-muted/10 text-[8px] font-mono text-center text-muted-foreground">
                CLICK TO FLIP FRONT
              </div>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={copyDetails}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Details
        </ContextMenuItem>
        <OpenInProviderMenuItem onPlay={handlePlay} />
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => setIsDeleteDialogOpen(true)}
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Remove Album
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
