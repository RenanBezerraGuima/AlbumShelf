'use client';

import { useMemo, useRef, useState } from 'react';
import type { Album } from '@/lib/types';
import { AlbumCard } from './album-card';
import {
  clampZoom,
  DEFAULT_CARD_SIZE,
  isAlbumVisible,
  screenToWorld,
  worldToScreen,
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

  const visibleAlbums = useMemo(() => {
    const container = containerRef.current;
    const viewport = {
      width: container?.clientWidth ?? window.innerWidth,
      height: container?.clientHeight ?? window.innerHeight,
    };

    return albums.filter((album) => {
      const position = album.position ?? { x: 0, y: 0 };
      return isAlbumVisible(position, camera, viewport, DEFAULT_CARD_SIZE);
    });
  }, [albums, camera]);

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

    const move = (moveEvent: PointerEvent) => {
      const deltaX = (moveEvent.clientX - startX) / camera.zoom;
      const deltaY = (moveEvent.clientY - startY) / camera.zoom;
      setAlbumPosition(folderId, album.id, initial.x + deltaX, initial.y + deltaY);
    };

    const up = () => {
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
      {visibleAlbums.map((album) => {
        const position = album.position ?? { x: 0, y: 0 };
        const screen = worldToScreen(position, camera);

        return (
          <div
            key={album.id}
            data-album-card
            className="absolute"
            style={{
              left: screen.x,
              top: screen.y,
              width: DEFAULT_CARD_SIZE.width,
              transform: `scale(${camera.zoom})`,
              transformOrigin: 'top left',
            }}
            onPointerDown={(event) => startAlbumDrag(event, album)}
          >
            <AlbumCard album={album} folderId={folderId} />
          </div>
        );
      })}
    </div>
  );
}
