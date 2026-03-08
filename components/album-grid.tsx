'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Music, Grid2X2, Orbit, Search, Menu, FolderPlus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { useFolderStore, findFolder, getBreadcrumb } from '@/lib/store';
import { preloadAlbumImages, registerAlbumImageServiceWorker } from '@/lib/album-image-cache';
import { AlbumCard } from './album-card';
import type { Album } from '@/lib/types';
import { cn } from '@/lib/utils';

const AlbumCanvas = dynamic(
  () => import('./album-canvas').then((mod) => mod.AlbumCanvas),
  {
    ssr: false,
    loading: () => <div data-testid="album-canvas-loading" className="flex-1" />,
  },
);

const GRID_PADDING_DESKTOP = 16;
const GRID_PADDING_MOBILE = 8;
const GRID_GAP_DESKTOP = 16;
const GRID_GAP_MOBILE = 8;
const GRID_OVERSCAN_ROWS = 2;
const GRID_DEFAULT_HEIGHT = 720;
const GRID_DEFAULT_WIDTH_DESKTOP = 1280;
const GRID_DEFAULT_WIDTH_MOBILE = 390;
const EAGER_IMAGE_COUNT_DESKTOP = 8;
const EAGER_IMAGE_COUNT_MOBILE = 4;
const PRELOAD_IMAGE_COUNT_DESKTOP = 24;
const PRELOAD_IMAGE_COUNT_MOBILE = 12;
const WARMUP_COPY_BY_MODE = {
  desktop: 'Staging local album art cache',
  mobile: 'Staging album art cache',
} as const;

function getGridColumnCount(width: number) {
  if (width >= 1280) return 6;
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
}

/**
 * Performance: Memoized item wrapper for the grid.
 * By using granular boolean props like 'isDragged' and 'isDropTarget' instead of
 * passing the raw indexes, we allow React to skip reconciliation for 99% of items
 * when the drop target changes during a drag operation.
 */
const DraggableAlbumItem = React.memo(function DraggableAlbumItem({
  album,
  index,
  folderId,
  isDragged,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  style,
  imageLoading,
  imageFetchPriority,
}: {
  album: Album;
  index: number;
  folderId: string;
  isDragged: boolean;
  isDropTarget: boolean;
  onDragStart: (e: React.DragEvent, album: Album, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: () => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
  style?: React.CSSProperties;
  imageLoading: 'lazy' | 'eager';
  imageFetchPriority: 'auto' | 'high' | 'low';
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, album, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={() => onDrop(index)}
      onDragEnd={onDragEnd}
      className={cn(
        'transition-all',
        isDragged && 'opacity-50',
        isDropTarget && 'ring-2 ring-primary ring-offset-2 rounded-none'
      )}
      style={style}
    >
      <AlbumCard
        album={album}
        folderId={folderId}
        imageLoading={imageLoading}
        imageFetchPriority={imageFetchPriority}
      />
    </div>
  );
});

export function AlbumGrid({ isMobile }: { isMobile?: boolean }) {
  // Use granular selectors to avoid re-renders when unrelated parts of the store change
  const selectedFolderId = useFolderStore(state => state.selectedFolderId);
  const folders = useFolderStore(state => state.sharedFolders ?? state.folders);
  const selectedFolder = useFolderStore(useCallback(state =>
    state.selectedFolderId ? findFolder(state.sharedFolders ?? state.folders, state.selectedFolderId) : null
  , []));

  const breadcrumb = useFolderStore(
    useShallow(state => state.selectedFolderId ? getBreadcrumb(state.sharedFolders ?? state.folders, state.selectedFolderId) : [])
  );

  const draggedAlbumIndex = useFolderStore(state => state.draggedAlbumIndex);
  const setFolderViewMode = useFolderStore(state => state.setFolderViewMode);

  const albumViewMode = selectedFolder?.viewMode || 'grid';
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const gridViewportRef = useRef<HTMLDivElement>(null);
  const [gridMetrics, setGridMetrics] = useState({
    viewportWidth: 0,
    viewportHeight: 0,
    scrollTop: 0,
  });
  const [coverWarmupProgress, setCoverWarmupProgress] = useState<{
    current: number;
    total: number;
    folderId: string;
  } | null>(null);
  const warmupSequenceRef = useRef(0);

  useEffect(() => {
    void registerAlbumImageServiceWorker();
  }, []);

  useEffect(() => {
    const albums = selectedFolder?.albums ?? [];
    if (!selectedFolderId || albums.length === 0) {
      setCoverWarmupProgress(null);
      return;
    }

    const requestId = ++warmupSequenceRef.current;
    setCoverWarmupProgress({
      current: 0,
      total: albums.length,
      folderId: selectedFolderId,
    });

    void preloadAlbumImages(
      albums.map((album) => album.imageUrl),
      isMobile ? PRELOAD_IMAGE_COUNT_MOBILE : PRELOAD_IMAGE_COUNT_DESKTOP,
      (current, total) => {
        if (warmupSequenceRef.current !== requestId) return;

        if (total === 0) {
          setCoverWarmupProgress(null);
          return;
        }

        setCoverWarmupProgress({
          current,
          total,
          folderId: selectedFolderId,
        });
      },
    ).finally(() => {
      if (warmupSequenceRef.current !== requestId) return;
      setCoverWarmupProgress(null);
    });
  }, [isMobile, selectedFolder?.albums, selectedFolderId]);

  useEffect(() => {
    if (albumViewMode !== 'grid') return;

    const node = gridViewportRef.current;
    if (!node) return;

    const updateMetrics = () => {
      const rect = node.getBoundingClientRect();
      setGridMetrics((current) => {
        const nextWidth =
          rect.width || (isMobile ? GRID_DEFAULT_WIDTH_MOBILE : GRID_DEFAULT_WIDTH_DESKTOP);
        const nextHeight = rect.height || GRID_DEFAULT_HEIGHT;
        const nextScrollTop = node.scrollTop;

        if (
          current.viewportWidth === nextWidth &&
          current.viewportHeight === nextHeight &&
          current.scrollTop === nextScrollTop
        ) {
          return current;
        }

        return {
          viewportWidth: nextWidth,
          viewportHeight: nextHeight,
          scrollTop: nextScrollTop,
        };
      });
    };

    updateMetrics();

    const handleScroll = () => {
      setGridMetrics((current) => {
        const nextScrollTop = node.scrollTop;
        if (current.scrollTop === nextScrollTop) return current;
        return { ...current, scrollTop: nextScrollTop };
      });
    };

    const observer = new ResizeObserver(updateMetrics);
    observer.observe(node);
    node.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateMetrics);

    return () => {
      observer.disconnect();
      node.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateMetrics);
    };
  }, [albumViewMode, isMobile, selectedFolderId]);

  const virtualGrid = useMemo(() => {
    const albums = selectedFolder?.albums ?? [];
    if (albums.length === 0) {
      return {
        totalHeight: 0,
        visibleAlbums: [] as Array<{ album: Album; index: number; style: React.CSSProperties }>,
      };
    }

    const padding = isMobile ? GRID_PADDING_MOBILE : GRID_PADDING_DESKTOP;
    const gap = isMobile ? GRID_GAP_MOBILE : GRID_GAP_DESKTOP;
    const viewportWidth =
      gridMetrics.viewportWidth || (isMobile ? GRID_DEFAULT_WIDTH_MOBILE : GRID_DEFAULT_WIDTH_DESKTOP);
    const viewportHeight = gridMetrics.viewportHeight || GRID_DEFAULT_HEIGHT;
    const columnCount = getGridColumnCount(viewportWidth);
    const itemWidth = Math.max(
      140,
      (viewportWidth - padding * 2 - gap * (columnCount - 1)) / columnCount,
    );
    const rowStride = itemWidth + gap;
    const rowCount = Math.ceil(albums.length / columnCount);
    const totalHeight =
      padding * 2 + rowCount * itemWidth + Math.max(0, rowCount - 1) * gap;

    const firstVisibleRow = Math.max(
      0,
      Math.floor(gridMetrics.scrollTop / rowStride) - GRID_OVERSCAN_ROWS,
    );
    const lastVisibleRow = Math.min(
      rowCount,
      Math.ceil((gridMetrics.scrollTop + viewportHeight) / rowStride) + GRID_OVERSCAN_ROWS,
    );

    const visibleAlbums = [];

    for (let row = firstVisibleRow; row < lastVisibleRow; row++) {
      for (let column = 0; column < columnCount; column++) {
        const index = row * columnCount + column;
        const album = albums[index];
        if (!album) break;

        visibleAlbums.push({
          album,
          index,
          style: {
            position: 'absolute' as const,
            top: padding + row * rowStride,
            left: padding + column * (itemWidth + gap),
            width: itemWidth,
          },
        });
      }
    }

    return { totalHeight, visibleAlbums };
  }, [gridMetrics, isMobile, selectedFolder?.albums]);

  const eagerImageCount = isMobile ? EAGER_IMAGE_COUNT_MOBILE : EAGER_IMAGE_COUNT_DESKTOP;
  const isWarmingAlbumArt = coverWarmupProgress?.folderId === selectedFolderId;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputActive = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');
      const isContentEditable = (document.activeElement as HTMLElement)?.isContentEditable;

      if (!isInputActive && !isContentEditable && !e.metaKey && !e.ctrlKey && !e.altKey && selectedFolderId) {
        if (e.key.toLowerCase() === 'g') {
          e.preventDefault();
          useFolderStore.getState().setFolderViewMode(selectedFolderId, 'grid');
        } else if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          useFolderStore.getState().setFolderViewMode(selectedFolderId, 'canvas');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFolderId]);

  // Performance: Handlers are stabilized with useCallback and use getState()
  // for store data to prevent re-rendering memoized DraggableAlbumItems.
  const handleDragStart = useCallback((e: React.DragEvent, album: Album, index: number) => {
    const { selectedFolderId, setDraggedAlbum } = useFolderStore.getState();
    if (!selectedFolderId) return;
    setDraggedAlbum(album, selectedFolderId, index);
    e.dataTransfer.setData('text/plain', album.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    const { draggedAlbumIndex } = useFolderStore.getState();
    // Optimization: Only update state if the drop target has actually changed.
    // This prevents redundant re-renders during high-frequency dragOver events.
    if (draggedAlbumIndex !== null && draggedAlbumIndex !== index) {
      setDropIndex(prev => prev !== index ? index : prev);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropIndex(null);
  }, []);

  const handleDrop = useCallback((index: number) => {
    const { selectedFolderId, draggedAlbumIndex, reorderAlbum, setDraggedAlbum } = useFolderStore.getState();
    if (selectedFolderId && draggedAlbumIndex !== null && draggedAlbumIndex !== index) {
      reorderAlbum(selectedFolderId, draggedAlbumIndex, index);
    }
    setDraggedAlbum(null, null, null);
    setDropIndex(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    useFolderStore.getState().setDraggedAlbum(null, null, null);
    setDropIndex(null);
  }, []);

  if (!selectedFolderId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground tracking-tighter" style={{ fontFamily: 'var(--font-body)' }}>
        <Music className="h-16 w-16 mb-4 opacity-10" />
        <p className="text-lg font-medium" style={{ fontFamily: 'var(--font-display)' }}>No collection selected</p>
        <p className="text-xs mt-1 mb-4" style={{ fontFamily: 'var(--font-mono)' }}>Select a catalog entry to begin</p>

        {folders.length === 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('albumshelf:create-collection'))}
            className="gap-2 rounded-none border-2 border-dashed border-muted-foreground/50 hover:border-primary hover:text-primary transition-all tracking-tighter font-medium h-auto py-3 px-4"
            title="Create your first collection [N]"
            aria-label="Create your first collection [N]"
            aria-keyshortcuts="n"
          >
            <FolderPlus className="h-4 w-4" />
            Create your first collection [N]
          </Button>
        ) : isMobile ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('albumshelf:open-menu'))}
            className="gap-2 rounded-none border-2 border-dashed border-muted-foreground/50 hover:border-primary hover:text-primary transition-all tracking-tighter font-medium h-auto py-3 px-4"
            title="Open collections menu"
            aria-label="Open collections menu"
          >
            <Menu className="h-4 w-4" />
            Open collections menu
          </Button>
        ) : null}
      </div>
    );
  }

  if (!selectedFolder) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
        <p>Error: Collection not found</p>
      </div>
    );
  }

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-col h-full bg-background outline-none">
      <div className={cn(
        "h-[73px] border-b-2 border-border shrink-0 flex flex-col justify-center bg-background",
        isMobile ? "p-3" : "p-4"
      )}>
        <div className={cn(
          'flex items-center justify-between gap-2 tracking-tighter opacity-70 mb-1',
          isMobile ? 'text-[9px]' : 'text-[10px]'
        )} style={{ fontFamily: 'var(--font-mono)' }}>
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            {breadcrumb.map((item, index) => (
              <span key={item.id} className="flex items-center gap-2 shrink-0">
                {index > 0 && <span aria-hidden="true" className="opacity-40">/</span>}
                {index === breadcrumb.length - 1 ? (
                  <span className="text-foreground font-semibold truncate" aria-current="page">
                    {item.name}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => useFolderStore.getState().setSelectedFolder(item.id)}
                    className="hover:text-primary hover:underline transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary px-0.5 rounded-sm cursor-pointer"
                    aria-label={`Go back to ${item.name}`}
                    title={`Go back to ${item.name}`}
                  >
                    {item.name}
                  </button>
                )}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFolderViewMode(selectedFolderId, 'grid')}
              className={cn('border border-border px-2 py-0.5', albumViewMode === 'grid' && 'bg-primary text-primary-foreground')}
              aria-label="Switch to grid view [G]"
              title="Grid view [G]"
              aria-keyshortcuts="g"
            >
              <Grid2X2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setFolderViewMode(selectedFolderId, 'canvas')}
              className={cn('border border-border px-2 py-0.5', albumViewMode === 'canvas' && 'bg-primary text-primary-foreground')}
              aria-label="Switch to canvas view [V]"
              title="Canvas view [V]"
              aria-keyshortcuts="v"
            >
              <Orbit className="h-3 w-3" />
            </button>
          </div>
        </div>
        <p className="text-[10px] tracking-widest text-primary font-medium" style={{ fontFamily: 'var(--font-body)' }}>
          {selectedFolder.albums.length} album{selectedFolder.albums.length !== 1 ? 's' : ''} // Catalog data
        </p>
      </div>

      {selectedFolder.albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground tracking-tighter" style={{ fontFamily: 'var(--font-body)' }}>
          <Music className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium" style={{ fontFamily: 'var(--font-display)' }}>Collection empty</p>
          <p className="text-[10px] mt-1 mb-4" style={{ fontFamily: 'var(--font-mono)' }}>Add albums via search interface</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('albumshelf:focus-search'))}
            className="gap-2 rounded-none border-2 border-dashed border-muted-foreground/50 hover:border-primary hover:text-primary transition-all tracking-tighter font-medium h-auto py-3 px-4"
            title="Find your first album [/]"
            aria-label="Find your first album [/]"
            aria-keyshortcuts="/"
          >
            <Search className="h-4 w-4" />
            Find your first album [/]
          </Button>
        </div>
      ) : isWarmingAlbumArt ? (
        <div
          className="flex-1 min-h-0 flex items-center justify-center border-t border-border/30 bg-background"
          data-testid="album-grid-cover-warmup"
        >
          <div className="w-full max-w-md px-6 py-8 text-center space-y-4">
            <div className="space-y-2">
              <p
                className="text-[10px] uppercase tracking-[0.35em] text-primary"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {isMobile ? WARMUP_COPY_BY_MODE.mobile : WARMUP_COPY_BY_MODE.desktop}
              </p>
              <h2
                className="text-xl font-semibold tracking-tight text-foreground"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Loading covers before opening {selectedFolder.name}
              </h2>
              <p
                className="text-xs text-muted-foreground"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {coverWarmupProgress?.total
                  ? `${coverWarmupProgress.current}/${coverWarmupProgress.total} covers cached locally`
                  : 'Preparing local album art cache'}
              </p>
            </div>

            <div className="h-2 border-2 border-border bg-muted/40">
              <div
                className="h-full bg-primary transition-[width] duration-200"
                style={{
                  width: coverWarmupProgress?.total
                    ? `${(coverWarmupProgress.current / coverWarmupProgress.total) * 100}%`
                    : '0%',
                }}
              />
            </div>
          </div>
        </div>
      ) : albumViewMode === 'canvas' ? (
        <AlbumCanvas albums={selectedFolder.albums} folderId={selectedFolderId} />
      ) : (
        <div
          ref={gridViewportRef}
          className="flex-1 min-h-0 overflow-auto"
          data-testid="album-grid-viewport"
        >
          <div
            className="relative"
            style={{ height: Math.max(virtualGrid.totalHeight, gridMetrics.viewportHeight || GRID_DEFAULT_HEIGHT) }}
          >
            {virtualGrid.visibleAlbums.map(({ album, index, style }, visibleIndex) => (
              <DraggableAlbumItem
                key={album.id}
                album={album}
                index={index}
                folderId={selectedFolderId}
                isDragged={draggedAlbumIndex === index}
                isDropTarget={dropIndex === index}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                style={style}
                imageLoading={visibleIndex < eagerImageCount ? 'eager' : 'lazy'}
                imageFetchPriority={visibleIndex < eagerImageCount ? 'high' : 'auto'}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
