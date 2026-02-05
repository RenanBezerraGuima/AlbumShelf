'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useFolderStore, StreamingProvider } from '@/lib/store';
import { Music, Radio } from 'lucide-react';

export function FirstTimeSetup() {
  const { folders, hasSetPreference, setStreamingProvider, setHasSetPreference } = useFolderStore();
  const [open, setOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const hasAlbums = useMemo(() => {
    const checkFolders = (folderList: typeof folders): boolean => {
      return folderList.some(f => f.albums.length > 0 || checkFolders(f.subfolders));
    };
    return checkFolders(folders);
  }, [folders]);

  useEffect(() => {
    if (isHydrated) {
      if (hasAlbums && !hasSetPreference) {
        // If they have albums but haven't explicitly set preference (legacy data),
        // we assume they've already used the app and don't show the popup.
        setHasSetPreference(true);
      } else if (!hasSetPreference) {
        setOpen(true);
      }
    }
  }, [isHydrated, hasSetPreference, hasAlbums, setHasSetPreference]);

  const handleSelect = (provider: StreamingProvider) => {
    setStreamingProvider(provider);
    setHasSetPreference(true);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[500px] border-4 border-primary brutalist-shadow">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Welcome to AlbumShelf</DialogTitle>
          <DialogDescription className="text-base font-mono uppercase pt-2">
            Your local-first music album organizer. Search for albums, organize them into collections, and keep everything in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="space-y-2">
            <h4 className="text-sm font-black uppercase tracking-tight border-b-2 border-border pb-1">
              Choose your streaming provider
            </h4>
            <p className="text-xs font-mono uppercase text-muted-foreground">
              This will determine where we search for albums and how we link to them. You can change this later in settings.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Button
              onClick={() => handleSelect('deezer')}
              variant="outline"
              className="h-24 flex flex-col gap-2 rounded-none border-2 border-border hover:border-primary hover:bg-primary/5 transition-all p-2"
            >
              <Radio className="h-6 w-6" />
              <span className="font-black uppercase text-xs">Deezer</span>
            </Button>
            <Button
              onClick={() => handleSelect('apple')}
              variant="outline"
              className="h-24 flex flex-col gap-2 rounded-none border-2 border-border hover:border-primary hover:bg-primary/5 transition-all p-2"
            >
              <Music className="h-6 w-6" />
              <span className="font-black uppercase text-xs text-center">Apple Music</span>
            </Button>
            <Button
              onClick={() => handleSelect('spotify')}
              variant="outline"
              className="h-24 flex flex-col gap-2 rounded-none border-2 border-border hover:border-primary hover:bg-primary/5 transition-all p-2"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm5.508 17.302c-.216.354-.674.464-1.028.248-2.812-1.718-6.352-2.106-10.518-1.154-.404.092-.81-.162-.902-.566-.092-.404.162-.81.566-.902 4.568-1.044 8.508-.6 11.634 1.312.354.216.464.674.248 1.028zm1.472-3.254c-.272.442-.848.582-1.29.31-3.22-1.978-8.124-2.554-11.928-1.398-.502.152-1.03-.132-1.182-.634-.152-.502.132-1.03.634-1.182 4.35-1.32 9.75-.672 13.456 1.606.442.27.582.848.31 1.298zm.126-3.414c-3.864-2.294-10.244-2.508-13.944-1.384-.592.18-1.218-.154-1.398-.746-.18-.592.154-1.218.746-1.398 4.256-1.292 11.298-1.044 15.748 1.6 0 .532-.18 1.158-.752 1.338-.592.182-1.218-.152-1.4-.744l.001-.166z"/>
              </svg>
              <span className="font-black uppercase text-xs">Spotify</span>
            </Button>
          </div>
        </div>

        <DialogFooter className="sm:justify-start">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">
            No account required. All data stays on your device.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
