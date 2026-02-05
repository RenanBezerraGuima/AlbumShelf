import { describe, it, expect, beforeEach } from 'vitest';
import { useFolderStore } from './store';
import { sanitizeUrl, sanitizeImageUrl } from './security';

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
    it('should allow valid http and https URLs', () => {
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
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

    it('should handle undefined or empty input', () => {
      expect(sanitizeUrl(undefined)).toBeUndefined();
      expect(sanitizeUrl('')).toBeUndefined();
    });
  });

  describe('sanitizeImageUrl', () => {
    it('should allow valid http and https image URLs', () => {
      expect(sanitizeImageUrl('https://example.com/image.jpg')).toBe('https://example.com/image.jpg');
    });

    it('should allow data:image/ protocols', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      expect(sanitizeImageUrl(dataUrl)).toBe(dataUrl);
    });

    it('should reject other data: protocols', () => {
      expect(sanitizeImageUrl('data:text/html,<html>')).toBeUndefined();
    });
  });
});
