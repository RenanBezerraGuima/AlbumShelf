'use client';

import { FolderTree } from '@/components/folder-tree';
import { AlbumGrid } from '@/components/album-grid';
import { AlbumSearch } from '@/components/album-search';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

export default function Home() {
  return (
    <main className="h-screen flex flex-col bg-background">
      <AlbumSearch />

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={20} minSize={15} maxSize={35} className="flex flex-col">
            <FolderTree />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={80} minSize={50} className="flex flex-col">
            <AlbumGrid />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </main>
  );
}
