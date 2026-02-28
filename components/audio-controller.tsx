"use client";

import React, { useEffect, useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Square, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { audioManager, type AudioState } from '@/lib/audio-store';
import { cn } from '@/lib/utils';

export function AudioController() {
  const [state, setState] = useState<AudioState>(audioManager.getState());

  useEffect(() => {
    return audioManager.subscribe(setState);
  }, []);

  if (!state.currentUrl && state.playlist.length === 0) return null;

  const handleTogglePlay = () => {
    if (state.currentUrl) {
      audioManager.play(state.currentUrl);
    }
  };

  const handleStop = () => {
    audioManager.stop();
  };

  const handleNext = () => {
    audioManager.next();
  };

  const handlePrev = () => {
    audioManager.prev();
  };

  const handleVolumeChange = (value: number[]) => {
    audioManager.setVolume(value[0]);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-background border-t-2 border-border p-3 animate-in slide-in-from-bottom-full duration-300">
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
          <Button
            size="icon"
            variant="ghost"
            onClick={handlePrev}
            disabled={state.currentIndex <= 0}
            className="h-8 w-8"
            title="Previous track"
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={handleStop}
            className="h-8 w-8 text-destructive hover:bg-destructive/10"
            title="Stop playback"
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>

          <Button
            size="icon"
            variant="default"
            onClick={handleTogglePlay}
            className="h-10 w-10 brutalist-shadow-sm"
            title={state.isPlaying ? "Pause" : "Play"}
          >
            {state.isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current" />
            )}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={handleNext}
            disabled={state.currentIndex >= state.playlist.length - 1}
            className="h-8 w-8"
            title="Next track"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Volume */}
        <div className="hidden md:flex items-center gap-3 w-48">
          {state.volume === 0 ? (
            <VolumeX className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
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
