export type Theme = 'industrial' | 'editorial' | 'glitch' | 'organic' | 'refined';

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
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  albums: Album[];
  subfolders: Folder[];
  isExpanded: boolean;
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
