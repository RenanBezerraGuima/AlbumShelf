"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Square, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { audioManager, type AudioState } from '@/lib/audio-store';
import { cn } from '@/lib/utils';

export function AudioController() {
  const [state, setState] = useState<AudioState>(audioManager.getState());
  const lastVolumeRef = useRef<number>(0.7);

  useEffect(() => {
    return audioManager.subscribe(setState);
  }, []);

  const handleTogglePlay = useCallback(() => {
    const s = audioManager.getState();
    if (s.currentUrl) audioManager.play(s.currentUrl);
  }, []);

  const handleNext = useCallback(() => audioManager.next(), []);
  const handlePrev = useCallback(() => audioManager.prev(), []);

  const toggleMute = useCallback(() => {
    const s = audioManager.getState();
    if (s.volume > 0) {
      lastVolumeRef.current = s.volume;
      audioManager.setVolume(0);
    } else {
      audioManager.setVolume(lastVolumeRef.current || 0.7);
    }
  }, []);

  const handleVolumeChange = (value: number[]) => audioManager.setVolume(value[0]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '') ||
          (document.activeElement as HTMLElement)?.isContentEditable ||
          e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === ' ') { e.preventDefault(); handleTogglePlay(); }
      else if (e.key === '[') { e.preventDefault(); handlePrev(); }
      else if (e.key === ']') { e.preventDefault(); handleNext(); }
      else if (e.key.toLowerCase() === 'm') { e.preventDefault(); toggleMute(); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, handlePrev, handleNext, toggleMute]);

  if (!state.currentUrl && state.playlist.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Audio player"
      className="fixed bottom-0 left-0 right-0 z-[100] bg-background border-t-2 border-border p-3 animate-in slide-in-from-bottom-full duration-300"
    >
      <div className="max-w-screen-2xl mx-auto flex items-center gap-4 md:gap-8">
        {/* Track Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-initial md:w-64">
          {state.albumImageUrl && (
            <img
              src={state.albumImageUrl}
              alt={state.albumName || "Album Art"}
              className="w-10 h-10 border border-border shrink-0 bg-muted"
              style={{ borderRadius: 'var(--radius)' }}
            />
          )}
          <div className="min-w-0">
            <h4 className="text-sm font-bold tracking-tighter truncate" style={{ fontFamily: 'var(--font-display)' }}>
              {state.currentTrack?.title || "No track playing"}
            </h4>
            <p className="text-[10px] text-muted-foreground font-mono truncate">
              {state.albumName || "Unknown Album"}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-1 md:gap-2 flex-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={handlePrev}
                disabled={state.currentIndex <= 0}
                className="h-8 w-8"
                aria-label="Previous track ([)"
                aria-keyshortcuts="["
              >
                <SkipBack className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-mono uppercase tracking-widest border-2 border-border brutalist-shadow-sm rounded-none">
              Previous track ([)
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleStop}
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                aria-label="Stop playback"
              >
                <Square className="h-4 w-4 fill-current" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-mono uppercase tracking-widest border-2 border-border brutalist-shadow-sm rounded-none">
              Stop playback
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="default"
                onClick={handleTogglePlay}
                className="h-10 w-10 brutalist-shadow-sm"
                aria-label={state.isPlaying ? "Pause [Space]" : "Play [Space]"}
                aria-keyshortcuts="Space"
              >
                {state.isPlaying ? (
                  <Pause className="h-5 w-5 fill-current" />
                ) : (
                  <Play className="h-5 w-5 fill-current" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-mono uppercase tracking-widest border-2 border-border brutalist-shadow-sm rounded-none">
              {state.isPlaying ? "Pause [Space]" : "Play [Space]"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleNext}
                disabled={state.currentIndex >= state.playlist.length - 1}
                className="h-8 w-8"
                aria-label="Next track (])"
                aria-keyshortcuts="]"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-mono uppercase tracking-widest border-2 border-border brutalist-shadow-sm rounded-none">
              Next track (])
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Volume */}
        <div className="hidden md:flex items-center gap-3 w-48">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 hover:bg-muted"
                onClick={toggleMute}
                aria-label={state.volume === 0 ? "Unmute [M]" : "Mute [M]"}
                aria-keyshortcuts="m"
              >
                {state.volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-mono uppercase tracking-widest border-2 border-border brutalist-shadow-sm rounded-none">
              {state.volume === 0 ? "Unmute [M]" : "Mute [M]"}
            </TooltipContent>
          </Tooltip>
          <Slider
            value={[state.volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={handleVolumeChange}
            className="w-full"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}
