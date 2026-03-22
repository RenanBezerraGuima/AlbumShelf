import { describe, it, expect } from 'vitest';
import { decompressData } from './share-service';
import { MAX_TOTAL_FOLDERS, MAX_TOTAL_ALBUMS } from './security';
import LZString from 'lz-string';

describe('Sentinel Security Hardening', () => {
  describe('Global DoS Protection in Sharing', () => {
    it('should enforce global folder limits during decompression', () => {
      // Create a structure with many small branches
      const folders: any[] = [];
      for (let i = 0; i < 100; i++) {
        const subfolders: any[] = [];
        for (let j = 0; j < 30; j++) {
            subfolders.push({ i: `s-${i}-${j}`, n: `Sub ${j}` });
        }
        folders.push({ i: `f-${i}`, n: `Folder ${i}`, s: subfolders });
      }

      const payload = { v: 2, p: 'deezer', f: folders };
      const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payload));

      const result = decompressData(compressed);

      // Count total folders
      const countFolders = (nodes: any[]): number => {
        return nodes.reduce((acc, node) => acc + 1 + countFolders(node.subfolders || []), 0);
      };

      expect(countFolders(result?.folders || [])).toBeLessThanOrEqual(MAX_TOTAL_FOLDERS);
    });

    it('should enforce global album limits during decompression', () => {
      const folders: any[] = [];
      // 5 folders, each with 3000 albums = 15000 total (limit is 10000)
      for (let i = 0; i < 5; i++) {
        const albums = Array.from({ length: 3000 }, (_, j) => ({ i: `a-${i}-${j}`, n: `Album ${j}` }));
        folders.push({ i: `f-${i}`, n: `Folder ${i}`, a: albums });
      }

      const payload = { v: 2, p: 'deezer', f: folders };
      const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payload));

      const result = decompressData(compressed);

      const countAlbums = (nodes: any[]): number => {
        return nodes.reduce((acc, node) => acc + (node.albums?.length || 0) + countAlbums(node.subfolders || []), 0);
      };

      expect(countAlbums(result?.folders || [])).toBeLessThanOrEqual(MAX_TOTAL_ALBUMS);
    });
  });
});
