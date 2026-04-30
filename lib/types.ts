export type Theme = 'industrial' | 'editorial' | 'organic' | 'refined' | 'mint';
export const THEMES: Theme[] = ['industrial', 'editorial', 'organic', 'refined', 'mint'];

export type GeistFont = 'mono';
export const GEIST_FONTS: GeistFont[] = ['mono'];

export type AlbumViewMode = 'grid' | 'canvas';
export const VIEW_MODES: AlbumViewMode[] = ['grid', 'canvas'];

export type SortOrder = 'manual' | 'artist' | 'title';
export const SORT_ORDERS: SortOrder[] = ['manual', 'artist', 'title'];

export type StreamingProvider = 'deezer' | 'apple' | 'spotify';
export const STREAMING_PROVIDERS: StreamingProvider[] = ['deezer', 'apple', 'spotify'];

export interface AlbumPosition {
  x: number;
  y: number;
}

export interface Album {
  id: string;
  spotifyId?: string;
  name: string;
  artist: string;
  imageUrl: string;
  releaseDate?: string;
  totalTracks: number;
  spotifyUrl?: string;
  externalUrl?: string;
  position?: AlbumPosition;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  albums: Album[];
  subfolders: Folder[];
  isExpanded: boolean;
  viewMode?: AlbumViewMode;
  sortOrder?: SortOrder;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: { name: string }[];
  images: { url: string; height: number; width: number }[];
  release_date: string;
  total_tracks: number;
  external_urls: { spotify: string };
}

export interface Track {
  id: string;
  title: string;
  preview: string;
  duration: number;
}

export interface AlbumDetails {
  tracks: Track[];
  label?: string;
  contributors?: string[];
}
