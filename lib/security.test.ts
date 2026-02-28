import { describe, it, expect, beforeEach } from 'vitest';
import { useFolderStore } from './store';
import { sanitizeUrl, sanitizeImageUrl, sanitizeAlbum, sanitizeFolder, sanitizeAlbumDetails } from './security';

describe('Security: Input Validation', () => {
  beforeEach(() => {
    useFolderStore.setState({ folders: [], selectedFolderId: null });
  });

  it('should truncate folder names to 100 characters during import', () => {
    const { importFolders } = useFolderStore.getState();

    const longName = 'A'.repeat(200);
    const importedData = [
      {
        id: 'old-id-1',
        name: longName,
        parentId: null,
        albums: [],
        subfolders: [],
        isExpanded: true
      }
    ];

    importFolders(importedData as any);

    const finalFolders = useFolderStore.getState().folders;
    expect(finalFolders[0].name.length).toBe(100);
    expect(finalFolders[0].name).toBe('A'.repeat(100));
  });

  it('should handle malicious properties in imported data by ignoring them', () => {
     const { importFolders } = useFolderStore.getState();

    const importedData = [
      {
        id: 'old-id-1',
        name: 'Safe Name',
        parentId: null,
        albums: [],
        subfolders: [],
        isExpanded: true,
        malicious: '<script>alert(1)</script>',
        extra: 'property'
      }
    ];

    importFolders(importedData as any);

    const finalFolders = useFolderStore.getState().folders;
    expect(finalFolders[0]).not.toHaveProperty('malicious');
    expect(finalFolders[0]).not.toHaveProperty('extra');
    // It should still have the expected properties
    expect(finalFolders[0].name).toBe('Safe Name');
  });

  it('should sanitize album URLs during import', () => {
    const { importFolders } = useFolderStore.getState();

    const importedData = [
      {
        id: 'folder-1',
        name: 'Folder 1',
        parentId: null,
        albums: [
          {
            id: 'album-1',
            name: 'Album 1',
            artist: 'Artist 1',
            imageUrl: 'javascript:alert(1)',
            externalUrl: 'javascript:alert(1)'
          }
        ],
        subfolders: [],
        isExpanded: true
      }
    ];

    importFolders(importedData as any);

    const finalFolders = useFolderStore.getState().folders;
    const album = finalFolders[0].albums[0];
    expect(album.imageUrl).toBe('/placeholder.svg');
    expect(album.externalUrl).toBeUndefined();
  });
});

describe('Security Utilities', () => {
  describe('sanitizeUrl', () => {
    it('should allow valid https URLs and reject http URLs', () => {
      expect(sanitizeUrl('http://example.com')).toBeUndefined();
      expect(sanitizeUrl('https://example.com/path?query=1')).toBe('https://example.com/path?query=1');
    });

    it('should allow safe relative paths', () => {
      expect(sanitizeUrl('/path/to/resource')).toBe('/path/to/resource');
      expect(sanitizeUrl('./local/path')).toBe('./local/path');
      expect(sanitizeUrl('../parent/path')).toBe('../parent/path');
    });

    it('should reject javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBeUndefined();
      expect(sanitizeUrl('  javascript:alert(1)  ')).toBeUndefined();
    });

    it('should reject other dangerous protocols', () => {
      expect(sanitizeUrl('data:text/html,<html>')).toBeUndefined();
      expect(sanitizeUrl('file:///etc/passwd')).toBeUndefined();
      expect(sanitizeUrl('vbscript:msgbox("XSS")')).toBeUndefined();
    });

    it('should reject protocol-relative URLs for security', () => {
      expect(sanitizeUrl('//evil.com')).toBeUndefined();
    });

    it('should reject backslash protocol-relative URL bypasses', () => {
      expect(sanitizeUrl('/\\evil.com')).toBeUndefined();
      expect(sanitizeUrl('\\/evil.com')).toBeUndefined();
    });

    it('should reject encoded protocol-relative bypasses', () => {
      expect(sanitizeUrl('/%5cevil.com')).toBeUndefined();
      expect(sanitizeUrl('/%2fevil.com')).toBeUndefined();
      expect(sanitizeUrl('/%5Cevil.com')).toBeUndefined();
      expect(sanitizeUrl('/%2Fevil.com')).toBeUndefined();
    });

    it('should reject URLs with control characters or internal whitespace', () => {
      expect(sanitizeUrl('https://example.com/path\nwith-newline')).toBeUndefined();
      expect(sanitizeUrl('https://example.com/path\twith-tab')).toBeUndefined();
      expect(sanitizeUrl('https://example.com/path\0with-null')).toBeUndefined();
      expect(sanitizeUrl('/path with space')).toBeUndefined();
    });

    it('should handle undefined or empty input', () => {
      expect(sanitizeUrl(undefined)).toBeUndefined();
      expect(sanitizeUrl('')).toBeUndefined();
    });
  });

  describe('sanitizeImageUrl', () => {
    it('should allow valid https image URLs and reject http', () => {
      expect(sanitizeImageUrl('https://example.com/image.jpg')).toBe('https://example.com/image.jpg');
      expect(sanitizeImageUrl('http://example.com/image.jpg')).toBeUndefined();
    });

    it('should allow data:image/ protocols', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      expect(sanitizeImageUrl(dataUrl)).toBe(dataUrl);
    });

    it('should reject other data: protocols', () => {
      expect(sanitizeImageUrl('data:text/html,<html>')).toBeUndefined();
    });

    it('should reject excessively long data URLs (>256KB)', () => {
      const longDataUrl = 'data:image/png;base64,' + 'A'.repeat(256 * 1024 + 1);
      expect(sanitizeImageUrl(longDataUrl)).toBeUndefined();
    });

    it('should allow reasonably sized data URLs (<=256KB)', () => {
      const safeDataUrl = 'data:image/png;base64,' + 'A'.repeat(100);
      expect(sanitizeImageUrl(safeDataUrl)).toBe(safeDataUrl);
    });

    it('should reject SVG data URLs to prevent potential XSS', () => {
      const svgDataUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=';
      expect(sanitizeImageUrl(svgDataUrl)).toBeUndefined();
    });

    it('should reject case-insensitive SVG data URLs', () => {
      const svgDataUrl = 'data:image/SVG+XML;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=';
      expect(sanitizeImageUrl(svgDataUrl)).toBeUndefined();
    });

    it('should reject encoded SVG data URLs', () => {
      const svgDataUrl = 'data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=';
      expect(sanitizeImageUrl(svgDataUrl)).toBeUndefined();
    });

    it('should allow case-insensitive data: protocol for safe images', () => {
      const dataUrl = 'DATA:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      expect(sanitizeImageUrl(dataUrl)).toBe(dataUrl);
    });
  });

  describe('jsonp', () => {
    it('should reject non-https URLs', async () => {
      const { jsonp } = await import('./security');
      await expect(jsonp('http://api.deezer.com/test')).rejects.toThrow('Insecure JSONP protocol');
    });

    it('should reject untrusted domains', async () => {
      const { jsonp } = await import('./security');
      await expect(jsonp('https://evil.com/test')).rejects.toThrow('Untrusted JSONP domain');
    });

    it('should reject URLs with existing callback parameter', async () => {
      const { jsonp } = await import('./security');
      await expect(jsonp('https://api.deezer.com/test?callback=evil')).rejects.toThrow('URL already contains a callback parameter');
    });

    it('should reject excessively long URLs', async () => {
      const { jsonp } = await import('./security');
      const longUrl = 'https://api.deezer.com/test?q=' + 'a'.repeat(3000);
      await expect(jsonp(longUrl)).rejects.toThrow('URL exceeds maximum length');
    });
  });

  describe('sanitizeAlbumDetails', () => {
    it('should sanitize and truncate tracks, label and contributors', () => {
      const longText = 'A'.repeat(300);
      const details = {
        tracks: [
          {
            id: longText,
            title: longText,
            preview: 'javascript:alert(1)',
            duration: 9999
          }
        ],
        label: longText,
        contributors: [longText]
      };

      const sanitized = sanitizeAlbumDetails(details);
      expect(sanitized.tracks[0].id.length).toBe(100);
      expect(sanitized.tracks[0].title.length).toBe(100);
      expect(sanitized.tracks[0].preview).toBe('');
      expect(sanitized.tracks[0].duration).toBe(3600);
      expect(sanitized.label?.length).toBe(200);
      expect(sanitized.contributors?.[0].length).toBe(100);
    });

    it('should enforce item limits for tracks and contributors', () => {
      const details = {
        tracks: Array(200).fill({ id: '1', title: 'T' }),
        contributors: Array(100).fill('C')
      };

      const sanitized = sanitizeAlbumDetails(details);
      expect(sanitized.tracks.length).toBe(100);
      expect(sanitized.contributors?.length).toBe(50);
    });

    it('should handle missing or invalid fields in details', () => {
      const details = {
        tracks: 'invalid',
        label: null,
        contributors: {}
      };

      const sanitized = sanitizeAlbumDetails(details as any);
      expect(sanitized.tracks).toEqual([]);
      expect(sanitized.label).toBeUndefined();
      expect(sanitized.contributors).toBeUndefined();
    });
  });

  describe('sanitizeAlbum', () => {
    it('should truncate id, name and artist to their respective limits', () => {
      const longText = 'A'.repeat(300);
      const album = {
        id: longText,
        name: longText,
        artist: longText,
        imageUrl: 'https://example.com/image.jpg',
        totalTracks: 10
      };

      const sanitized = sanitizeAlbum(album);
      expect(sanitized.id.length).toBe(100);
      expect(sanitized.name.length).toBe(200);
      expect(sanitized.artist.length).toBe(200);
    });

    it('should clamp totalTracks between 0 and 1000', () => {
      expect(sanitizeAlbum({ totalTracks: 9999 } as any).totalTracks).toBe(1000);
      expect(sanitizeAlbum({ totalTracks: -5 } as any).totalTracks).toBe(0);
      expect(sanitizeAlbum({ totalTracks: Infinity } as any).totalTracks).toBe(1000);
    });


    it('should sanitize all URL fields in an album', () => {
      const album = {
        id: '1',
        name: 'Test',
        artist: 'Test',
        imageUrl: 'javascript:alert(1)',
        externalUrl: 'javascript:alert(2)',
        spotifyUrl: 'javascript:alert(3)'
      };

      const sanitized = sanitizeAlbum(album);
      expect(sanitized.imageUrl).toBe('/placeholder.svg');
      expect(sanitized.externalUrl).toBeUndefined();
      expect(sanitized.spotifyUrl).toBeUndefined();
    });

    it('should handle missing or invalid fields gracefully and provide fallback ID', () => {
      const album = {
        id: '',
        // missing name, artist
        totalTracks: 'invalid'
      };

      const sanitized = sanitizeAlbum(album);
      expect(sanitized.id).toBeDefined();
      expect(sanitized.id.length).toBeGreaterThan(0);
      expect(sanitized.name).toBe('Unknown Album');
      expect(sanitized.artist).toBe('Unknown Artist');
      expect(sanitized.totalTracks).toBe(0);
    });

    it('should regenerate album IDs when regenerateId is true', () => {
      const album = { id: 'old-id', name: 'Test', artist: 'Test' };
      const sanitized = sanitizeAlbum(album, true);
      expect(sanitized.id).not.toBe('old-id');
      expect(sanitized.id.length).toBeGreaterThan(0);
    });

    it('should preserve and sanitize the position field if present', () => {
      const album = {
        id: '1',
        name: 'Test',
        artist: 'Test',
        position: { x: 100, y: 200, malicious: 'property' }
      };

      const sanitized = sanitizeAlbum(album);
      expect(sanitized.position).toEqual({ x: 100, y: 200 });
      expect(sanitized.position).not.toHaveProperty('malicious');
    });

    it('should reject non-finite position coordinates', () => {
      const album = {
        id: '1',
        name: 'Test',
        artist: 'Test',
        position: { x: Infinity, y: NaN }
      };

      const sanitized = sanitizeAlbum(album);
      expect(sanitized.position).toBeUndefined();
    });
  });

  describe('sanitizeFolder', () => {
    it('should recursively sanitize folder names and nested albums', () => {
      const longName = 'F'.repeat(200);
      const folder = {
        id: 'f1',
        name: longName,
        albums: [
          {
            id: 'a1',
            name: 'Album 1',
            artist: 'Artist 1',
            imageUrl: 'javascript:alert(1)'
          }
        ],
        subfolders: [
          {
            id: 'f2',
            name: 'Subfolder',
            albums: []
          }
        ]
      };

      const sanitized = sanitizeFolder(folder);
      expect(sanitized.name.length).toBe(100);
      expect(sanitized.albums[0].imageUrl).toBe('/placeholder.svg');
      expect(sanitized.subfolders[0].parentId).toBe('f1');
      expect(sanitized.subfolders[0].name).toBe('Subfolder');
    });

    it('should regenerate IDs and update parentIds when regenerateIds is true', () => {
      const folder = {
        id: 'old-root',
        name: 'Root',
        albums: [{ id: 'old-album', name: 'Album', artist: 'Artist' }],
        subfolders: [
          {
            id: 'old-sub',
            name: 'Sub',
            albums: []
          }
        ]
      };

      const sanitized = sanitizeFolder(folder, true);
      expect(sanitized.id).not.toBe('old-root');
      expect(sanitized.albums[0].id).not.toBe('old-album');
      expect(sanitized.subfolders[0].id).not.toBe('old-sub');
      expect(sanitized.subfolders[0].parentId).toBe(sanitized.id);
    });

    it('should use the provided albumMapper', () => {
      const folder = {
        id: 'f1',
        name: 'Test',
        albums: [{ id: 'a1', name: 'Album', artist: 'Artist' }]
      };
      const mapper = (a: any) => ({ ...a, name: 'Mapped' });

      const sanitized = sanitizeFolder(folder, false, null, mapper);
      expect(sanitized.albums[0].name).toBe('Mapped');
    });

    it('should filter out unknown properties', () => {
      const folder = {
        id: 'f1',
        name: 'Test',
        malicious: 'property',
        albums: [],
        subfolders: []
      };

      const sanitized = sanitizeFolder(folder);
      expect(sanitized).not.toHaveProperty('malicious');
      expect(sanitized.name).toBe('Test');
    });

    it('should enforce recursion depth limits to prevent DoS', () => {
      // Create a deeply nested folder structure
      const createDeepFolder = (depth: number): any => {
        if (depth === 0) return { id: 'leaf', name: 'Leaf', subfolders: [] };
        return {
          id: `f-${depth}`,
          name: `Folder ${depth}`,
          subfolders: [createDeepFolder(depth - 1)]
        };
      };

      const deepFolder = createDeepFolder(60); // Above the limit of 50
      const sanitized = sanitizeFolder(deepFolder);

      // Verify the tree is truncated
      let current = sanitized;
      let actualDepth = 0;
      while (current.subfolders && current.subfolders.length > 0) {
        current = current.subfolders[0];
        actualDepth++;
      }

      expect(actualDepth).toBe(50);
    });

    it('should enforce limits on albums and subfolders per folder', () => {
      const largeFolder = {
        id: 'large',
        name: 'Large',
        albums: Array(6000).fill({ id: 'a', name: 'A', artist: 'A' }),
        subfolders: Array(200).fill({ id: 's', name: 'S' })
      };

      const sanitized = sanitizeFolder(largeFolder);
      expect(sanitized.albums.length).toBe(5000);
      expect(sanitized.subfolders.length).toBe(100);
    });
  });
});

describe('Security: State Hydration', () => {
  it('should truncate selectedFolderId during rehydration', () => {
    // We can test the rehydration logic by manually calling the hook
    const onRehydrate = (useFolderStore.persist as any).getOptions().onRehydrateStorage;
    const callback = onRehydrate(useFolderStore.getState());

    const longId = 'A'.repeat(200);
    const state: any = { selectedFolderId: longId };
    callback(state);

    expect(state.selectedFolderId.length).toBe(100);
    expect(state.selectedFolderId).toBe('A'.repeat(100));
  });

  it('should validate spotifyTokenExpiry during rehydration', () => {
    const onRehydrate = (useFolderStore.persist as any).getOptions().onRehydrateStorage;
    const callback = onRehydrate(useFolderStore.getState());

    const state: any = { spotifyTokenExpiry: 'invalid' };
    callback(state);
    expect(state.spotifyTokenExpiry).toBeNull();

    const state2: any = { spotifyTokenExpiry: Infinity };
    callback(state2);
    expect(state2.spotifyTokenExpiry).toBeNull();

    const state3: any = { spotifyTokenExpiry: 3600 };
    callback(state3);
    expect(state3.spotifyTokenExpiry).toBe(3600);
  });
});
