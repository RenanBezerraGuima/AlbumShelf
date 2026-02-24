import { describe, it, expect, vi } from 'vitest';
import { compressData, decompressData, generateShareUrl } from './share-service';
import { Folder } from './types';
import LZString from 'lz-string';

describe('share-service', () => {
  const mockFolders: Folder[] = [
    {
      id: 'folder-1',
      name: 'Test Folder',
      parentId: null,
      albums: [
        {
          id: 'album-1',
          name: 'Test Album',
          artist: 'Test Artist',
          imageUrl: 'https://example.com/image.jpg',
          totalTracks: 10,
          spotifyId: 'abc',
          releaseDate: '2023-01-01',
          spotifyUrl: 'https://spotify.com/1',
          externalUrl: 'https://ext.com/1',
          position: { x: 100, y: 200 }
        }
      ],
      subfolders: [],
      isExpanded: true,
      viewMode: 'grid',
    }
  ];

  it('should compress and decompress data correctly using compact format', () => {
    const compressed = compressData(mockFolders);
    expect(typeof compressed).toBe('string');

    // Check if it's actually compacting (comparing with old JSON stringify length)
    const oldJson = JSON.stringify(mockFolders);
    const compactJson = LZString.decompressFromEncodedURIComponent(compressed);
    expect(compactJson!.length).toBeLessThan(oldJson.length);

    const decompressed = decompressData(compressed);
    expect(decompressed).toBeDefined();
    expect(decompressed![0].name).toBe(mockFolders[0].name);
    expect(decompressed![0].albums[0].name).toBe(mockFolders[0].albums[0].name);
    expect(decompressed![0].albums[0].artist).toBe(mockFolders[0].albums[0].artist);
    expect(decompressed![0].albums[0].position).toEqual(mockFolders[0].albums[0].position);
  });

  it('should be backward compatible with old JSON format', () => {
    const oldJson = JSON.stringify(mockFolders);
    const oldCompressed = LZString.compressToEncodedURIComponent(oldJson);

    const decompressed = decompressData(oldCompressed);
    expect(decompressed).toBeDefined();
    expect(decompressed![0].name).toBe(mockFolders[0].name);
    expect(decompressed![0].albums[0].name).toBe(mockFolders[0].albums[0].name);
  });

  it('should return null for invalid compressed data', () => {
    expect(decompressData('invalid-data')).toBeNull();
    expect(decompressData('')).toBeNull();
  });

  it('should generate a share URL', () => {
    // Mock window.location
    const originalLocation = window.location;
    // @ts-ignore
    delete window.location;
    window.location = new URL('https://app.example.com/') as any;

    const url = generateShareUrl(mockFolders);
    expect(url).toContain('share=');
    expect(url).toContain('https://app.example.com/');

    // Restore window.location
    window.location = originalLocation;
  });
});
