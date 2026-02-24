'use client';

import React from 'react';
import { Share2, Import, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFolderStore } from '@/lib/store';

export function ShareBanner() {
  const sharedFolders = useFolderStore((state) => state.sharedFolders);
  const setSharedFolders = useFolderStore((state) => state.setSharedFolders);
  const importFolders = useFolderStore((state) => state.importFolders);

  if (!sharedFolders) return null;

  const handleImport = () => {
    importFolders(sharedFolders);
    setSharedFolders(null);
    // Remove the share param from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('share');
    window.history.replaceState({}, '', url.toString());
  };

  const handleExit = () => {
    setSharedFolders(null);
    // Remove the share param from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('share');
    window.history.replaceState({}, '', url.toString());
  };

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
            Temporary view • {sharedFolders.length} collection{sharedFolders.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleImport}
          className="h-8 text-[10px] font-bold uppercase tracking-wider rounded-none gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
        >
          <Import className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Import to my collections</span>
          <span className="sm:hidden">Import</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExit}
          className="h-8 w-8 p-0 text-primary-foreground hover:bg-primary-foreground/10 rounded-none"
          title="Exit shared view"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
