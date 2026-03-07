'use client';

import React, { useEffect, useCallback } from 'react';
import { Share2, Import, X, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useFolderStore } from '@/lib/store';

export function ShareBanner() {
  const isGuestMode = useFolderStore((state) => state.isGuestMode);
  const sharedFolders = useFolderStore((state) => state.sharedFolders);
  const hydrationProgress = useFolderStore((state) => state.hydrationProgress);
  const exitGuestMode = useFolderStore((state) => state.exitGuestMode);
  const importFolders = useFolderStore((state) => state.importFolders);

  const handleImport = useCallback(() => {
    if (!sharedFolders) return;
    importFolders(sharedFolders);
    toast.success('Collection imported!', {
      description: `${sharedFolders.length} collection${sharedFolders.length !== 1 ? 's' : ''} added to your shelf.`,
    });
    exitGuestMode();
  }, [sharedFolders, importFolders, exitGuestMode]);

  const handleExit = useCallback(() => {
    exitGuestMode();
  }, [exitGuestMode]);

  useEffect(() => {
    if (!isGuestMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputActive = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');
      const isContentEditable = (document.activeElement as HTMLElement)?.isContentEditable;

      if (isInputActive || isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        handleImport();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGuestMode, handleImport, handleExit]);

  if (!isGuestMode || !sharedFolders) return null;

  return (
    <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between gap-4 z-[100] border-b-2 border-primary-foreground/20 animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary-foreground/20 p-1.5 rounded-sm shrink-0">
          <Share2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-tight uppercase flex items-center gap-1.5">
            Viewing shared shelf
            <Info className="h-3 w-3 opacity-60" />
          </p>
          <p className="text-[10px] font-mono opacity-80 truncate">
            {hydrationProgress
              ? `Hydrating metadata: ${hydrationProgress.current}/${hydrationProgress.total}...`
              : `Temporary view • ${sharedFolders.length} collection${sharedFolders.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleImport}
          className="h-8 text-[10px] font-bold uppercase tracking-wider rounded-none gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
          aria-label="Import to my collections [I]"
          aria-keyshortcuts="i"
        >
          <Import className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Import to my collections [I]</span>
          <span className="sm:hidden">Import [I]</span>
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExit}
              className="h-8 w-8 p-0 text-primary-foreground hover:bg-primary-foreground/10 rounded-none"
              aria-label="Exit shared view [Esc]"
              aria-keyshortcuts="Escape"
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px] font-mono uppercase tracking-widest border-2 border-border brutalist-shadow-sm rounded-none">
            Exit shared view [Esc]
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
