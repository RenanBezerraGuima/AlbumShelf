/**
 * Global audio manager to ensure only one preview plays at a time.
 */

type AudioStatusCallback = (isPlaying: boolean, url: string | null) => void;

let globalAudio: HTMLAudioElement | null = null;
let currentPreviewUrl: string | null = null;
let subscribers: Set<AudioStatusCallback> = new Set();

const notifySubscribers = (isPlaying: boolean, url: string | null) => {
  subscribers.forEach(cb => cb(isPlaying, url));
};

export const audioManager = {
  play: (url: string) => {
    if (typeof window === 'undefined') return;

    if (currentPreviewUrl === url && globalAudio) {
      if (globalAudio.paused) {
        globalAudio.play();
        notifySubscribers(true, url);
      } else {
        globalAudio.pause();
        notifySubscribers(false, url);
      }
      return;
    }

    if (globalAudio) {
      globalAudio.pause();
    }

    globalAudio = new Audio(url);
    currentPreviewUrl = url;

    globalAudio.onended = () => {
      notifySubscribers(false, null);
      currentPreviewUrl = null;
    };

    globalAudio.play();
    notifySubscribers(true, url);
  },

  stop: () => {
    if (globalAudio) {
      globalAudio.pause();
      notifySubscribers(false, null);
      currentPreviewUrl = null;
    }
  },

  subscribe: (callback: AudioStatusCallback) => {
    subscribers.add(callback);
    // Initial status for the new subscriber
    callback(globalAudio ? !globalAudio.paused : false, currentPreviewUrl);

    return () => {
      subscribers.delete(callback);
    };
  },

  getCurrentUrl: () => currentPreviewUrl,
  isPlaying: () => globalAudio ? !globalAudio.paused : false,
};
