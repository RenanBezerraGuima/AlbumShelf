import { describe, it, expect, beforeEach } from 'vitest';
import {
  isValidTheme,
  isValidViewMode,
  isValidStreamingProvider,
  isValidGeistFont,
  sanitizeAlbum,
  sanitizeFolder,
  sanitizeAlbumDetails
} from './security';
import { useFolderStore } from './store';

describe('Security Validation', () => {
  describe('isValidTheme', () => {
    it('should return true for valid themes', () => {
      expect(isValidTheme('industrial')).toBe(true);
      expect(isValidTheme('editorial')).toBe(true);
    });

    it('should return false for invalid themes', () => {
      expect(isValidTheme('invalid')).toBe(false);
      expect(isValidTheme('')).toBe(false);
      expect(isValidTheme(null)).toBe(false);
      expect(isValidTheme(123)).toBe(false);
      expect(isValidTheme('theme-industrial theme-malicious')).toBe(false);
    });
  });

  describe('isValidViewMode', () => {
    it('should return true for valid view modes', () => {
      expect(isValidViewMode('grid')).toBe(true);
      expect(isValidViewMode('canvas')).toBe(true);
    });

    it('should return false for invalid view modes', () => {
      expect(isValidViewMode('invalid')).toBe(false);
      expect(isValidViewMode('')).toBe(false);
      expect(isValidViewMode('grid-malicious')).toBe(false);
    });
  });

  describe('isValidStreamingProvider', () => {
    it('should return true for valid streaming providers', () => {
      expect(isValidStreamingProvider('deezer')).toBe(true);
      expect(isValidStreamingProvider('apple')).toBe(true);
      expect(isValidStreamingProvider('spotify')).toBe(true);
    });

    it('should return false for invalid streaming providers', () => {
      expect(isValidStreamingProvider('invalid')).toBe(false);
      expect(isValidStreamingProvider('youtube')).toBe(false);
    });
  });

  describe('isValidGeistFont', () => {
    it('should return true for valid fonts', () => {
      expect(isValidGeistFont('mono')).toBe(true);
    });

    it('should return false for invalid fonts', () => {
      expect(isValidGeistFont('serif')).toBe(false);
      expect(isValidGeistFont('sans')).toBe(false);
      expect(isValidGeistFont(null)).toBe(false);
    });
  });

  describe('sanitizeText enforcement', () => {
    it('should strip control characters from album and artist names', () => {
      const album = {
        id: '1',
        name: 'Album\x00Name',
        artist: 'Artist\x1FName',
        imageUrl: 'https://example.com/image.jpg'
      };
      const sanitized = sanitizeAlbum(album);
      expect(sanitized.name).toBe('AlbumName');
      expect(sanitized.artist).toBe('ArtistName');
    });

    it('should strip control characters from folder names', () => {
      const folder = {
        id: '1',
        name: 'Folder\x0AName',
        albums: [],
        subfolders: []
      };
      const sanitized = sanitizeFolder(folder);
      expect(sanitized.name).toBe('FolderName');
    });

    it('should strip control characters from album details', () => {
      const details = {
        tracks: [{ id: '1', title: 'Track\x7FTitle', preview: 'https://example.com/p.mp3' }],
        label: 'Label\x01Name',
        contributors: ['Artist\x02Name']
      };
      const sanitized = sanitizeAlbumDetails(details);
      expect(sanitized.tracks[0].title).toBe('TrackTitle');
      expect(sanitized.label).toBe('LabelName');
      expect(sanitized.contributors?.[0]).toBe('ArtistName');
    });
  });

  describe('Store enforcement', () => {
    beforeEach(() => {
      useFolderStore.setState({
        theme: 'industrial',
        streamingProvider: 'deezer',
        folders: []
      });
    });

    it('should not update theme if invalid', () => {
      const { setTheme } = useFolderStore.getState();
      setTheme('invalid' as any);
      expect(useFolderStore.getState().theme).toBe('industrial');
    });

    it('should not update streaming provider if invalid', () => {
      const { setStreamingProvider } = useFolderStore.getState();
      setStreamingProvider('invalid' as any);
      expect(useFolderStore.getState().streamingProvider).toBe('deezer');
    });

    it('should fallback to grid view during import if invalid viewMode is provided', () => {
      const { importFolders } = useFolderStore.getState();
      const maliciousFolder = {
        id: '1',
        name: 'Malicious',
        parentId: null,
        albums: [],
        subfolders: [],
        isExpanded: true,
        viewMode: 'something-else'
      };

      importFolders([maliciousFolder as any]);

      const folders = useFolderStore.getState().folders;
      expect(folders[0].viewMode).toBe('grid');
    });
  });
});
