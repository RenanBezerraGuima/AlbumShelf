/**
 * Global audio manager to ensure only one preview plays at a time.
 * Supports volume control, playlists (album tracks), and track navigation.
 */

import type { Track } from './types';

export interface AudioState {
  isPlaying: boolean;
  currentUrl: string | null;
  currentTrack: Track | null;
  volume: number;
  playlist: Track[];
  currentIndex: number;
  albumName: string | null;
  albumImageUrl: string | null;
}

type AudioStatusCallback = (state: AudioState) => void;

let globalAudio: HTMLAudioElement | null = null;
let state: AudioState = {
  isPlaying: false,
  currentUrl: null,
  currentTrack: null,
  volume: 0.7,
  playlist: [],
  currentIndex: -1,
  albumName: null,
  albumImageUrl: null,
};

let subscribers: Set<AudioStatusCallback> = new Set();

const notifySubscribers = () => {
  subscribers.forEach(cb => cb({ ...state }));
};

const updateState = (updates: Partial<AudioState>) => {
  state = { ...state, ...updates };
  notifySubscribers();
};

export const audioManager = {
  play: (url: string, track?: Track, playlist: Track[] = [], albumName?: string, albumImageUrl?: string) => {
    if (typeof window === 'undefined') return;

    if (state.currentUrl === url && globalAudio) {
      if (globalAudio.paused) {
        globalAudio.play();
        updateState({ isPlaying: true });
      } else {
        globalAudio.pause();
        updateState({ isPlaying: false });
      }
      return;
    }

    if (globalAudio) {
      globalAudio.pause();
    }

    globalAudio = new Audio(url);
    globalAudio.volume = state.volume;

    const index = playlist.findIndex(t => t.preview === url);

    updateState({
      isPlaying: true,
      currentUrl: url,
      currentTrack: track || null,
      playlist,
      currentIndex: index,
      albumName: albumName || null,
      albumImageUrl: albumImageUrl || null
    });

    globalAudio.onended = () => {
      if (state.playlist.length > 0 && state.currentIndex < state.playlist.length - 1) {
        audioManager.next();
      } else {
        updateState({ isPlaying: false });
      }
    };

    globalAudio.play().catch(err => {
      console.error("Audio playback failed:", err);
      updateState({ isPlaying: false });
    });
  },

  stop: () => {
    if (globalAudio) {
      globalAudio.pause();
      globalAudio.currentTime = 0;
      updateState({ isPlaying: false });
    }
  },

  setVolume: (volume: number) => {
    const vol = Math.max(0, Math.min(1, volume));
    updateState({ volume: vol });
    if (globalAudio) {
      globalAudio.volume = vol;
    }
  },

  next: () => {
    if (state.playlist.length === 0 || state.currentIndex === -1) return;

    let nextIndex = state.currentIndex + 1;
    while (nextIndex < state.playlist.length) {
      const track = state.playlist[nextIndex];
      if (track.preview) {
        audioManager.play(track.preview, track, state.playlist, state.albumName || undefined, state.albumImageUrl || undefined);
        return;
      }
      nextIndex++;
    }
    // No more tracks with previews
    audioManager.stop();
  },

  prev: () => {
    if (state.playlist.length === 0 || state.currentIndex === -1) return;

    let prevIndex = state.currentIndex - 1;
    while (prevIndex >= 0) {
      const track = state.playlist[prevIndex];
      if (track.preview) {
        audioManager.play(track.preview, track, state.playlist, state.albumName || undefined, state.albumImageUrl || undefined);
        return;
      }
      prevIndex--;
    }
  },

  subscribe: (callback: AudioStatusCallback) => {
    subscribers.add(callback);
    callback({ ...state });

    return () => {
      subscribers.delete(callback);
    };
  },

  getState: () => ({ ...state }),
};
