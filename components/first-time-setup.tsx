'use client';

import React, { useEffect, useState } from 'react';
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
  const { hasSetPreference, setStreamingProvider, setHasSetPreference } = useFolderStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hasSetPreference) {
      setOpen(true);
    }
  }, [hasSetPreference]);

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              onClick={() => handleSelect('deezer')}
              variant="outline"
              className="h-24 flex flex-col gap-2 rounded-none border-2 border-border hover:border-primary hover:bg-primary/5 transition-all"
            >
              <Radio className="h-6 w-6" />
              <span className="font-black uppercase">Deezer</span>
            </Button>
            <Button
              onClick={() => handleSelect('apple')}
              variant="outline"
              className="h-24 flex flex-col gap-2 rounded-none border-2 border-border hover:border-primary hover:bg-primary/5 transition-all"
            >
              <Music className="h-6 w-6" />
              <span className="font-black uppercase">Apple Music</span>
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
