import { describe, it, expect, vi } from 'vitest';
import { compressData, decompressData, generateShareUrl } from './share-service';
import { Folder } from './types';

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
        }
      ],
      subfolders: [],
      isExpanded: true,
      viewMode: 'grid',
    }
  ];

  it('should compress and decompress data correctly', () => {
    const compressed = compressData(mockFolders);
    expect(typeof compressed).toBe('string');
    expect(compressed.length).toBeGreaterThan(0);

    const decompressed = decompressData(compressed);
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
