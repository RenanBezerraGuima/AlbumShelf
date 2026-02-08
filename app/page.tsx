'use client';

import { useState } from 'react';
import { FolderTree } from '@/components/folder-tree';
import { AlbumGrid } from '@/components/album-grid';
import { AlbumSearch } from '@/components/album-search';
import { FirstTimeSetup } from '@/components/first-time-setup';
import { SpotifyCallbackHandler } from '@/components/spotify-callback-handler';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from '@/components/ui/dialog';

export default function Home() {
  const isMobile = useIsMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <main className="h-screen flex flex-col bg-background relative overflow-hidden">
      <FirstTimeSetup />
      <SpotifyCallbackHandler />
      <AlbumSearch isMobile={isMobile} onMenuClick={() => setIsMenuOpen(true)} />

      <div className="flex-1 min-h-0 z-10">
        {isMobile ? (
          <>
            <AlbumGrid isMobile={true} />
            <Dialog open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DialogContent className="p-0 sm:max-w-[300px] h-[100dvh] left-0 translate-x-0 top-0 translate-y-0 border-r-2 border-l-0 border-y-0 rounded-none shadow-none [&>button[aria-label='Close']]:hidden">
                <DialogHeader className="sr-only">
                  <DialogTitle>Collections Menu</DialogTitle>
                  <DialogDescription>Browse your music collections</DialogDescription>
                </DialogHeader>
                <div className="h-full flex flex-col overflow-hidden" onClick={(e) => {
                  // Only close if we clicked a folder item (not a button or input)
                  const target = e.target as HTMLElement;
                  if (target.closest('.cursor-pointer') && !target.closest('button') && !target.closest('input')) {
                    setIsMenuOpen(false);
                  }
                }}>
                  <div className="h-full [&>div]:border-r-0">
                    <FolderTree />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={20} minSize={15} maxSize={35} className="flex flex-col">
              <FolderTree />
            </ResizablePanel>

            <ResizableHandle withHandle className="w-2 bg-border hover:bg-primary transition-colors" />

            <ResizablePanel defaultSize={80} minSize={50} className="flex flex-col">
              <AlbumGrid />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </main>
  );
}
