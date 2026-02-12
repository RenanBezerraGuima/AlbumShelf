'use client';

import { useMemo, useRef, useState } from 'react';
import type { Album } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AlbumCard } from './album-card';
import {
  clampZoom,
  DEFAULT_CARD_SIZE,
  getViewportWorldBoundaries,
  isAlbumVisibleInWorld,
  screenToWorld,
  type CameraState,
} from '@/lib/spatial';
import { useFolderStore } from '@/lib/store';

interface AlbumCanvasProps {
  albums: Album[];
  folderId: string;
}

export function AlbumCanvas({ albums, folderId }: AlbumCanvasProps) {
  const setAlbumPosition = useFolderStore((state) => state.setAlbumPosition);
  const containerRef = useRef<HTMLDivElement>(null);

  const [camera, setCamera] = useState<CameraState>({ x: 48, y: 24, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggedAlbum, setDraggedAlbum] = useState<{
    id: string;
    initialPos: { x: number; y: number };
    currentPos: { x: number; y: number };
  } | null>(null);

  const visibleAlbums = useMemo(() => {
    const container = containerRef.current;
    const viewport = {
      width: container?.clientWidth ?? window.innerWidth,
      height: container?.clientHeight ?? window.innerHeight,
    };

    // Pre-calculate world viewport boundaries once per render to avoid
    // redundant calculations in the O(N) filter loop.
    const bounds = getViewportWorldBoundaries(camera, viewport);

    return albums.filter((album) => {
      // Always include the dragged album so it doesn't pop out of existence
      // if moved out of its initial world-space bounds while dragging.
      if (album.id === draggedAlbum?.id) return true;
      const pos = album.position ?? { x: 0, y: 0 };
      return isAlbumVisibleInWorld(pos, bounds, DEFAULT_CARD_SIZE);
    });
  }, [albums, camera, draggedAlbum?.id]);

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-album-card]')) {
      return;
    }

    setIsPanning(true);
    const startX = event.clientX;
    const startY = event.clientY;
    const initialCamera = camera;

    const move = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      setCamera((prev) => ({ ...prev, x: initialCamera.x + deltaX, y: initialCamera.y + deltaY }));
    };

    const up = () => {
      setIsPanning(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const zoomCanvas = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const containerBounds = containerRef.current?.getBoundingClientRect();
    if (!containerBounds) return;

    const cursor = {
      x: event.clientX - containerBounds.left,
      y: event.clientY - containerBounds.top,
    };

    const worldBeforeZoom = screenToWorld(cursor, camera);
    const nextZoom = clampZoom(camera.zoom - event.deltaY * 0.001);

    const newCamera = {
      zoom: nextZoom,
      x: cursor.x - worldBeforeZoom.x * nextZoom,
      y: cursor.y - worldBeforeZoom.y * nextZoom,
    };

    setCamera(newCamera);
  };

  const startAlbumDrag = (event: React.PointerEvent<HTMLDivElement>, album: Album) => {
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const initial = album.position ?? { x: 0, y: 0 };

    setDraggedAlbum({ id: album.id, initialPos: initial, currentPos: initial });

    const move = (moveEvent: PointerEvent) => {
      const deltaX = (moveEvent.clientX - startX) / camera.zoom;
      const deltaY = (moveEvent.clientY - startY) / camera.zoom;
      const newPos = { x: initial.x + deltaX, y: initial.y + deltaY };
      setDraggedAlbum((prev) => (prev ? { ...prev, currentPos: newPos } : null));
    };

    const up = (upEvent: PointerEvent) => {
      const deltaX = (upEvent.clientX - startX) / camera.zoom;
      const deltaY = (upEvent.clientY - startY) / camera.zoom;
      setAlbumPosition(folderId, album.id, initial.x + deltaX, initial.y + deltaY);
      setDraggedAlbum(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-background"
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      onPointerDown={startPan}
      onWheel={zoomCanvas}
      data-testid="album-canvas"
    >
      <div
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          transformOrigin: '0 0',
        }}
        className="absolute inset-0 pointer-events-none"
      >
        {visibleAlbums.map((album) => {
          const isDragging = draggedAlbum?.id === album.id;
          const position = isDragging
            ? draggedAlbum.currentPos
            : (album.position ?? { x: 0, y: 0 });

          return (
            <div
              key={album.id}
              data-album-card
              className={cn('absolute pointer-events-auto', isDragging && 'z-50')}
              style={{
                left: position.x,
                top: position.y,
                width: DEFAULT_CARD_SIZE.width,
              }}
              onPointerDown={(event) => startAlbumDrag(event, album)}
            >
              <AlbumCard album={album} folderId={folderId} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
