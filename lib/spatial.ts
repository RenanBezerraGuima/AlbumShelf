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

export interface WorldBoundaries {
  left: number;
  top: number;
  right: number;
  bottom: number;
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

/**
 * Calculates the viewport boundaries in world space, including an optional margin.
 * Pre-calculating these boundaries allows for efficient O(1) visibility checks
 * in large collections.
 */
export const getViewportWorldBoundaries = (
  camera: CameraState,
  viewport: CanvasViewport,
  margin = 200,
): WorldBoundaries => {
  const invZoom = 1 / camera.zoom;
  return {
    left: (-camera.x - margin) * invZoom,
    top: (-camera.y - margin) * invZoom,
    right: (viewport.width - camera.x + margin) * invZoom,
    bottom: (viewport.height - camera.y + margin) * invZoom,
  };
};

/**
 * Checks if an album is visible within the given world-space boundaries.
 */
export const isAlbumVisibleInWorld = (
  position: AlbumPosition,
  bounds: WorldBoundaries,
  card = DEFAULT_CARD_SIZE,
): boolean => {
  return (
    position.x + card.width >= bounds.left &&
    position.y + card.height >= bounds.top &&
    position.x <= bounds.right &&
    position.y <= bounds.bottom
  );
};

export const isAlbumVisible = (
  position: AlbumPosition,
  camera: CameraState,
  viewport: CanvasViewport,
  card = DEFAULT_CARD_SIZE,
  margin = 200,
): boolean => {
  const bounds = getViewportWorldBoundaries(camera, viewport, margin);
  return isAlbumVisibleInWorld(position, bounds, card);
};
