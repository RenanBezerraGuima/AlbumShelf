import { describe, it, expect, vi } from 'vitest';
import { compressData, decompressData, generateShareUrl } from './share-service';
import { Folder } from './types';
import LZString from 'lz-string';

describe('share-service v2 (reference-based)', () => {
  const mockFolders: Folder[] = [
    {
      id: 'folder-1',
      name: 'Test Folder',
      parentId: null,
      albums: [
        {
          id: 'spotify-1',
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

  it('should compress and decompress data correctly with metadata stripping', () => {
    const compressed = compressData(mockFolders, 'spotify');
    expect(typeof compressed).toBe('string');

    // Check if it's actually stripping (comparing with full JSON)
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    expect(json).not.toContain('Test Album'); // Metadata should be stripped
    expect(json).toContain('spotify-1'); // ID should be preserved

    const data = decompressData(compressed);
    expect(data).toBeDefined();
    expect(data!.folders[0].name).toBe(mockFolders[0].name);
    expect(data!.folders[0].albums[0].id).toBe('spotify-1');
    expect(data!.folders[0].albums[0].name).toBe('Loading...'); // Placeholder for hydration
    expect((data!.folders[0].albums[0] as any)._needsHydration).toBe(true);
    expect(data!.provider).toBe('spotify');
  });

  it('should be backward compatible with v1 (compact format)', () => {
    // V1 was just an array of compact folders
    const v1Compact = [{
        i: 'f1', n: 'Folder', a: [{ i: 'a1', n: 'Album' }]
    }];
    const v1Compressed = LZString.compressToEncodedURIComponent(JSON.stringify(v1Compact));

    const data = decompressData(v1Compressed);
    expect(data).toBeDefined();
    expect(data!.folders[0].name).toBe('Folder');
    expect(data!.folders[0].albums[0].name).toBe('Album');
  });

  it('should be backward compatible with v0 (legacy JSON)', () => {
    const v0Compressed = LZString.compressToEncodedURIComponent(JSON.stringify(mockFolders));

    const data = decompressData(v0Compressed);
    expect(data).toBeDefined();
    expect(data!.folders[0].name).toBe('Test Folder');
  });

  it('should handle decompression of invalid json strings gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const invalidCompressed = LZString.compressToEncodedURIComponent('not valid json');
    const data = decompressData(invalidCompressed);
    expect(data).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should return null when decompressing empty or invalid data', () => {
    expect(decompressData('')).toBeNull();
    expect(decompressData('!!! invalid !!!')).toBeNull();
  });

  it('should return null for valid JSON that is not a recognized payload', () => {
    const json = JSON.stringify({ unknown: 'data' });
    const compressed = LZString.compressToEncodedURIComponent(json);
    const result = decompressData(compressed);
    expect(result).toBeNull();
  });

  it('should return empty string if compression fails', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const circular: any = [];
    circular.push(circular);
    const result = compressData(circular, 'deezer');
    expect(result).toBe('');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should generate a share URL with hash', () => {
    const url = generateShareUrl(mockFolders, 'deezer');
    expect(url).toContain('#/share/');
    expect(url).toContain('http://localhost:3000/');
  });
});
