'use client';

import { useState, useEffect } from 'react';
import { FolderTree } from '@/components/folder-tree';
import { AlbumGrid } from '@/components/album-grid';
import { AlbumSearch } from '@/components/album-search';
import { FirstTimeSetup } from '@/components/first-time-setup';
import { SettingsDialog } from '@/components/settings-dialog';
import { SpotifyCallbackHandler } from '@/components/spotify-callback-handler';
import { MobileHeader } from '@/components/mobile-header';
import { ShareBanner } from '@/components/share-banner';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from '@/components/ui/dialog';
import { useFolderStore } from '@/lib/store';
import { decompressData } from '@/lib/share-service';
import { hydrateAlbums } from '@/lib/hydration-service';

export default function Home() {
  const isMobile = useIsMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const sharedFolders = useFolderStore(state => state.sharedFolders);

  useEffect(() => {
    // Check for share parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const shareData = urlParams.get('share');

    if (shareData) {
      const data = decompressData(shareData);
      if (data) {
        const { folders, provider } = data;
        useFolderStore.getState().setSharedFolders(folders);
        // Select the first folder if none selected
        if (folders.length > 0) {
          useFolderStore.getState().setSelectedFolder(folders[0].id);
        }

        // Hydration logic
        if (provider) {
          const { spotifyToken, setHydrationProgress, hydrateSharedFolders } = useFolderStore.getState();

          // Collect all IDs that need hydration
          const idsToHydrate = new Set<string>();
          const collectIds = (nodes: any[]) => {
            nodes.forEach(n => {
              n.albums?.forEach((a: any) => {
                if (a._needsHydration) idsToHydrate.add(a.id);
              });
              if (n.subfolders) collectIds(n.subfolders);
            });
          };
          collectIds(folders);

          if (idsToHydrate.size > 0) {
            setHydrationProgress({ current: 0, total: idsToHydrate.size });

            hydrateAlbums(
              Array.from(idsToHydrate),
              provider,
              spotifyToken,
              (current, total) => setHydrationProgress({ current, total })
            ).then(albumMap => {
              hydrateSharedFolders(albumMap);
              setHydrationProgress(null);
            });
          }
        }
      }
    }
  }, []);

  return (
    <main className="h-[100dvh] flex flex-col bg-background relative overflow-hidden">
      <FirstTimeSetup />
      <SettingsDialog />
      <SpotifyCallbackHandler />
      <ShareBanner />

      {isMobile ? (
        <MobileHeader onMenuClick={() => setIsMenuOpen(true)} />
      ) : (
        <AlbumSearch isMobile={isMobile} onMenuClick={() => setIsMenuOpen(true)} />
      )}

      <div className="flex-1 min-h-0 z-10 relative flex flex-col">
        {isMobile ? (
          <>
            <div className="flex-1 min-h-0 overflow-hidden">
              <AlbumGrid isMobile={true} />
            </div>

            <Dialog open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DialogContent className="p-0 sm:max-w-[300px] h-[100dvh] left-0 translate-x-0 top-0 translate-y-0 border-r-2 border-l-0 border-y-0 rounded-none shadow-none [&>button[aria-label='Close']]:hidden z-[100]">
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
            <AlbumSearch isMobile={true} />
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
