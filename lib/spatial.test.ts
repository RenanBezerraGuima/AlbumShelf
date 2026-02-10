import { describe, expect, it } from 'vitest';
import {
  clampZoom,
  createInitialAlbumPosition,
  isAlbumVisible,
  screenToWorld,
  worldToScreen,
} from './spatial';

describe('Spatial utilities', () => {
  it('Given a world point, when converted to screen and back, then the same world point is recovered', () => {
    const camera = { x: 250, y: -120, zoom: 1.5 };
    const worldPoint = { x: 400, y: 300 };

    const screenPoint = worldToScreen(worldPoint, camera);
    const recoveredWorldPoint = screenToWorld(screenPoint, camera);

    expect(recoveredWorldPoint.x).toBeCloseTo(worldPoint.x, 5);
    expect(recoveredWorldPoint.y).toBeCloseTo(worldPoint.y, 5);
  });

  it('Given an album index, when creating initial position, then rows and columns follow the configured grid', () => {
    expect(createInitialAlbumPosition(0, 6)).toEqual({ x: 0, y: 0 });
    expect(createInitialAlbumPosition(5, 6)).toEqual({ x: 1220, y: 0 });
    expect(createInitialAlbumPosition(6, 6)).toEqual({ x: 0, y: 344 });
  });

  it('Given a viewport and camera, when checking visibility, then albums inside and far outside are differentiated', () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    const viewport = { width: 1200, height: 800 };

    expect(isAlbumVisible({ x: 100, y: 100 }, camera, viewport)).toBe(true);
    expect(isAlbumVisible({ x: 8000, y: 8000 }, camera, viewport)).toBe(false);
  });

  it('Given invalid zoom values, when clamped, then values remain within allowed bounds', () => {
    expect(clampZoom(0.1)).toBe(0.4);
    expect(clampZoom(5)).toBe(3);
    expect(clampZoom(1.2)).toBe(1.2);
  });
});
