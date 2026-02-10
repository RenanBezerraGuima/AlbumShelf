import type { Album, AlbumPosition } from './types';

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasViewport {
  width: number;
  height: number;
}

export interface AlbumCardSize {
  width: number;
  height: number;
}

export const DEFAULT_CARD_SIZE: AlbumCardSize = {
  width: 220,
  height: 320,
};

const DEFAULT_ZOOM_MIN = 0.4;
const DEFAULT_ZOOM_MAX = 3;

export const clampZoom = (
  zoom: number,
  min = DEFAULT_ZOOM_MIN,
  max = DEFAULT_ZOOM_MAX,
): number => Math.min(max, Math.max(min, zoom));

export const worldToScreen = (
  point: AlbumPosition,
  camera: CameraState,
): AlbumPosition => ({
  x: point.x * camera.zoom + camera.x,
  y: point.y * camera.zoom + camera.y,
});

export const screenToWorld = (
  point: AlbumPosition,
  camera: CameraState,
): AlbumPosition => ({
  x: (point.x - camera.x) / camera.zoom,
  y: (point.y - camera.y) / camera.zoom,
});

export const createInitialAlbumPosition = (
  index: number,
  columns = 6,
  gap = 24,
  card = DEFAULT_CARD_SIZE,
): AlbumPosition => {
  const row = Math.floor(index / columns);
  const col = index % columns;

  return {
    x: col * (card.width + gap),
    y: row * (card.height + gap),
  };
};

export const normalizeAlbumPosition = (
  album: Album,
  index: number,
): Album => {
  if (album.position) {
    return album;
  }

  return {
    ...album,
    position: createInitialAlbumPosition(index),
  };
};

export const isAlbumVisible = (
  position: AlbumPosition,
  camera: CameraState,
  viewport: CanvasViewport,
  card = DEFAULT_CARD_SIZE,
  margin = 200,
): boolean => {
  const topLeft = worldToScreen(position, camera);
  const width = card.width * camera.zoom;
  const height = card.height * camera.zoom;

  return (
    topLeft.x + width >= -margin &&
    topLeft.y + height >= -margin &&
    topLeft.x <= viewport.width + margin &&
    topLeft.y <= viewport.height + margin
  );
};
