'use client';

import React, { useEffect, useState, useCallback } from "react";
import { Play, Pause, Trash2, Copy, ExternalLink, Music, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import type { Album, AlbumDetails, Track } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getAlbumDetailsDeezer } from '@/lib/search-service';
import { audioManager, type AudioState } from '@/lib/audio-store';

interface AlbumCardProps {
  album: Album;
  folderId: string;
}

interface AlbumDetailsContentProps {
  album: Album;
  details: AlbumDetails;
  isFlipped: boolean;
}

/**
 * Performance: Memoized track item component.
 * By isolating the track row, we turn O(N) reconciliations into O(1)
 * for track changes within the list.
 */
const TrackItem = React.memo(function TrackItem({
  track,
  index,
  isTrackPlaying,
  onPlay,
}: {
  track: Track;
  index: number;
  isTrackPlaying: boolean;
  onPlay: (track: Track) => void;
}) {
  return (
    <div
      className={cn(
        "group/track flex items-center gap-2 p-1.5 hover:bg-primary/10 transition-colors text-[10px] leading-tight",
        isTrackPlaying && "bg-primary/20",
        !track.preview && "opacity-50 cursor-not-allowed"
      )}
      onClick={(e) => {
        e.stopPropagation();
        if (track.preview) {
          onPlay(track);
        }
      }}
    >
      <span className="text-muted-foreground w-3 shrink-0">{index + 1}.</span>
      <span className="flex-1 truncate font-medium">{track.title}</span>
      <div className="shrink-0">
        {isTrackPlaying ? (
          <Pause className="h-3 w-3 fill-current text-primary" />
        ) : track.preview ? (
          <Play className="h-3 w-3 opacity-0 group-hover/track:opacity-100 transition-opacity" />
        ) : null}
      </div>
    </div>
  );
});

/**
 * Performance: Separate component for the album details (tracklist).
 * By isolating the 'audioManager' subscription here, we ensure that
 * only cards that are actually flipped (and showing their tracklist)
 * re-render when the global audio state changes.
 * This turns an O(Total Albums) re-render into O(Flipped Albums).
 */
const AlbumDetailsContent = React.memo(function AlbumDetailsContent({
  album,
  details,
  isFlipped,
}: AlbumDetailsContentProps) {
  const [audioState, setAudioState] = useState<AudioState>(audioManager.getState());

  useEffect(() => {
    if (!isFlipped) return;
    // Performance: Sync the local state immediately upon subscription to ensure the UI
    // matches the global state if it changed while the card was unsubscribed.
    setAudioState(audioManager.getState());
    return audioManager.subscribe((newState) => {
      setAudioState((oldState) => {
        // Performance: Only trigger re-render if playing status or current track changed.
        // Unrelated changes like volume updates will be ignored by this component.
        if (
          oldState.isPlaying === newState.isPlaying &&
          oldState.currentUrl === newState.currentUrl
        ) {
          return oldState;
        }
        return newState;
      });
    });
  }, [isFlipped]);

  const handleTrackPlay = useCallback((track: Track) => {
    audioManager.play(
      track.preview,
      track,
      details.tracks,
      album.name,
      album.imageUrl
    );
  }, [details.tracks, album.name, album.imageUrl]);

  return (
    <div className="space-y-0.5">
      {details.tracks.map((track, idx) => (
        <TrackItem
          key={track.id}
          track={track}
          index={idx}
          isTrackPlaying={audioState.isPlaying && audioState.currentUrl === track.preview}
          onPlay={handleTrackPlay}
        />
      ))}

      {(details.label || details.contributors) && (
        <div className="mt-4 p-2 border-t border-border/50 space-y-2">
          {details.label && (
            <div>
              <p className="text-[7px] uppercase font-bold text-muted-foreground tracking-tighter">Label</p>
              <p className="text-[9px] tracking-tighter">{details.label}</p>
            </div>
          )}
          {details.contributors && (
            <div>
              <p className="text-[7px] uppercase font-bold text-muted-foreground tracking-tighter">Contributors</p>
              <p className="text-[9px] leading-tight tracking-tighter">
                {details.contributors.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

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

export const AlbumCard = React.memo(function AlbumCard({ album, folderId }: AlbumCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [details, setDetails] = useState<AlbumDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const handleFlip = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (!isFlipped && !details) {
      setIsLoadingDetails(true);
      try {
        // We still use the Deezer API for details as it's the most reliable for tracklists
        // and doesn't require auth like Spotify. We use the original ID or search.
        const data = await getAlbumDetailsDeezer(album.id);
        setDetails(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingDetails(false);
      }
    }

    if (isFlipped) {
      // Don't stop audio when flipping back, only when clicking close on a specific album
    }

    setIsFlipped(!isFlipped);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleFlip(e);
    } else if (e.key === 'Escape' && isFlipped) {
      e.preventDefault();
      handleFlip(e);
      audioManager.stop();
    }
  };

  const handleRemove = () => {
    useFolderStore.getState().removeAlbumFromFolder(folderId, album.id);
    setIsDeleteDialogOpen(false);
  };

  const handlePlay = useCallback((e: React.MouseEvent) => {
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
  }, [album.externalUrl, album.name, album.artist]);

  const copyDetails = useCallback(() => {
    navigator.clipboard.writeText(`${album.artist} - ${album.name}`);
    toast.success('Copied to clipboard!', {
      description: `${album.artist} - ${album.name}`,
    });
  }, [album.artist, album.name]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          data-album-card
          tabIndex={0}
          role="button"
          aria-expanded={isFlipped}
          aria-label={`${album.name} by ${album.artist}${isFlipped ? ' - showing tracklist' : ' - click to flip'}`}
          className={cn(
            'group relative aspect-square perspective-1000 transition-all duration-200 hover:brutalist-shadow hover:-translate-x-1 hover:-translate-y-1 active:translate-x-0 active:translate-y-0 focus-within:brutalist-shadow focus-within:-translate-x-1 focus-within:-translate-y-1 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
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
          onKeyDown={handleKeyDown}
        >
          <div className={cn(
            "relative w-full h-full transition-transform duration-700 preserve-3d cursor-pointer",
            isFlipped && "rotate-y-180"
          )}>
            {/* Front Side */}
            <div
              data-testid="album-card-front"
              className={cn(
                'absolute inset-0 bg-card overflow-hidden border-2 border-border backface-hidden'
              )}
              style={{ borderRadius: 'var(--radius)' }}
            >
      <div className="absolute top-2 right-2 opacity-40 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10">
        <Tooltip>
          <TooltipTrigger asChild>
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
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-[10px] font-mono uppercase tracking-widest border-2 border-border brutalist-shadow-sm bg-destructive text-white rounded-none">
            Remove album
          </TooltipContent>
        </Tooltip>
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
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              className="absolute bottom-2 right-2 opacity-40 group-hover:opacity-100 focus-visible:opacity-100 transition-all duration-200 z-10 border-2 border-border brutalist-shadow-sm"
              style={{ borderRadius: 'var(--radius)' }}
              onClick={handlePlay}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Play album"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-[10px] font-mono uppercase tracking-widest border-2 border-border brutalist-shadow-sm bg-primary text-primary-foreground rounded-none">
            Play album
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="p-3 bg-card tracking-tighter" style={{ fontFamily: 'var(--font-body)' }}>
        <h3 className="font-medium text-sm text-foreground truncate" title={album.name} style={{ fontFamily: 'var(--font-display)' }}>
          {album.name}
        </h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="text-[10px] truncate mt-0.5 transition-colors duration-300 cursor-pointer hover:text-primary text-muted-foreground text-left w-full outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-sm"
              onClick={(e) => {
                e.stopPropagation();
                copyDetails();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                }
              }}
              aria-label={`Copy album details: ${album.artist} - ${album.name}`}
            >
              {album.artist}
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px] font-mono uppercase tracking-widest border-2 border-border brutalist-shadow-sm rounded-none">
            {album.artist} [Click to copy]
          </TooltipContent>
        </Tooltip>
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
                  <div className="space-y-3 p-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-3 w-4 shrink-0 rounded-none bg-muted-foreground/10" />
                        <Skeleton className="h-3 flex-1 rounded-none bg-muted-foreground/10" />
                        <Skeleton className="h-3 w-6 rounded-none bg-muted-foreground/10" />
                      </div>
                    ))}
                  </div>
                ) : details ? (
                  <AlbumDetailsContent
                    album={album}
                    details={details}
                    isFlipped={isFlipped}
                  />
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
