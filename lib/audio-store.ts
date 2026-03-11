/**
 * Global audio manager to ensure only one preview plays at a time.
 * Supports volume control, playlists (album tracks), and track navigation.
 */

import type { Track } from './types';
import { sanitizeUrl, sanitizeImageUrl, sanitizeText, sanitizeTrack } from './security';

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

const VOLUME_STORAGE_KEY = 'album-shelf-volume';

let globalAudio: HTMLAudioElement | null = null;

const getInitialVolume = () => {
  if (typeof window === 'undefined') return 0.7;
  try {
    const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (saved !== null) {
      const vol = parseFloat(saved);
      if (!isNaN(vol)) return Math.max(0, Math.min(1, vol));
    }
  } catch (e) {
    console.error('Failed to load volume from localStorage:', e);
  }
  return 0.7;
};

let state: AudioState = {
  isPlaying: false,
  currentUrl: null,
  currentTrack: null,
  volume: getInitialVolume(),
  playlist: [],
  currentIndex: -1,
  albumName: null,
  albumImageUrl: null,
};

let subscribers: Set<AudioStatusCallback> = new Set();

const notifySubscribers = () => {
  subscribers.forEach(cb => cb(state));
};

const updateState = (updates: Partial<AudioState>) => {
  // Performance: Perform a shallow equality check before applying updates
  // to prevent redundant state updates and unnecessary subscriber notifications.
  const hasChanged = Object.entries(updates).some(([key, value]) => {
    return state[key as keyof AudioState] !== value;
  });

  if (!hasChanged) return;

  state = { ...state, ...updates };
  notifySubscribers();
};

export const audioManager = {
  play: (url: string, track?: Track, playlist: Track[] = [], albumName?: string, albumImageUrl?: string) => {
    if (typeof window === 'undefined') return;

    const sanitizedUrl = sanitizeUrl(url);
    if (!sanitizedUrl) return;

    // Sink-level sanitization for defense-in-depth
    const sanitizedTrack = track ? sanitizeTrack(track) : null;
    const sanitizedPlaylist: Track[] = [];
    if (Array.isArray(playlist)) {
      // Limit to 100 tracks to prevent DoS from massive unvalidated arrays
      for (let i = 0; i < playlist.length && sanitizedPlaylist.length < 100; i++) {
        sanitizedPlaylist.push(sanitizeTrack(playlist[i], i));
      }
    }

    if (state.currentUrl === sanitizedUrl && globalAudio) {
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

    globalAudio = new Audio(sanitizedUrl);
    globalAudio.volume = state.volume;

    const index = playlist.findIndex(t => t.preview === sanitizedUrl);

    updateState({
      isPlaying: true,
      currentUrl: sanitizedUrl,
      currentTrack: sanitizedTrack,
      playlist: sanitizedPlaylist,
      currentIndex: index,
      albumName: albumName ? sanitizeText(albumName) : null,
      albumImageUrl: sanitizeImageUrl(albumImageUrl) || null
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

  reset: () => {
    if (globalAudio) {
      globalAudio.pause();
      globalAudio = null;
    }
    updateState({
      isPlaying: false,
      currentUrl: null,
      currentTrack: null,
      currentIndex: -1,
      playlist: [],
      albumName: null,
      albumImageUrl: null
    });
  },

  setVolume: (volume: number) => {
    // Defense-in-depth: Ensure volume is a finite number
    const numericVolume = typeof volume === 'number' && Number.isFinite(volume) ? volume : 0.7;
    const vol = Math.max(0, Math.min(1, numericVolume));
    updateState({ volume: vol });
    if (globalAudio) {
      globalAudio.volume = vol;
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(VOLUME_STORAGE_KEY, vol.toString());
      } catch (e) {
        console.error('Failed to save volume to localStorage:', e);
      }
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
    callback(state);

    return () => {
      subscribers.delete(callback);
    };
  },

  getState: () => state,
};
