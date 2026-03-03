import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioManager } from './audio-store';

describe('audioManager', () => {
  beforeEach(() => {
    // Reset state before each test
    audioManager.reset();
    audioManager.setVolume(0.7);

    // Correctly mock Audio as a constructor on window
    class AudioMock {
      play = vi.fn().mockResolvedValue(undefined);
      pause = vi.fn();
      volume = 1;
      onended = null;
      currentTime = 0;
      constructor(public src: string) {}
    }

    vi.stubGlobal('Audio', AudioMock);
  });

  it('should initialize with default state', () => {
    const state = audioManager.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.currentUrl).toBe(null);
    expect(state.volume).toBe(0.7);
  });

  it('should update volume and persist it', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    audioManager.setVolume(0.5);
    expect(audioManager.getState().volume).toBe(0.5);
    expect(setItemSpy).toHaveBeenCalledWith('album-shelf-volume', '0.5');
    setItemSpy.mockRestore();
  });

  it('should handle playlist navigation', () => {
    const playlist = [
      { id: '1', title: 'Track 1', preview: 'https://example.com/1.mp3', duration: 30 },
      { id: '2', title: 'Track 2', preview: 'https://example.com/2.mp3', duration: 30 },
    ];

    audioManager.play('https://example.com/1.mp3', playlist[0], playlist, 'Album', 'https://example.com/art.jpg');
    let state = audioManager.getState();
    expect(state.currentIndex).toBe(0);
    expect(state.currentUrl).toBe('https://example.com/1.mp3');

    audioManager.next();
    state = audioManager.getState();
    expect(state.currentIndex).toBe(1);
    expect(state.currentUrl).toBe('https://example.com/2.mp3');
  });

  it('should stop playback but keep metadata', () => {
    audioManager.play('https://example.com/1.mp3');
    audioManager.stop();
    expect(audioManager.getState().isPlaying).toBe(false);
    expect(audioManager.getState().currentUrl).toBe('https://example.com/1.mp3');
  });

  it('should publish state updates to subscribers and allow unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = audioManager.subscribe(listener);

    audioManager.play('https://example.com/a.mp3');
    expect(listener).toHaveBeenCalled();

    const callsBefore = listener.mock.calls.length;
    unsubscribe();
    audioManager.stop();
    expect(listener.mock.calls.length).toBe(callsBefore);
  });

  it('should skip tracks without preview when navigating next', () => {
    const playlist = [
      { id: '1', title: 'Track 1', preview: 'https://example.com/1.mp3', duration: 30 },
      { id: '2', title: 'Track 2', preview: '', duration: 30 },
      { id: '3', title: 'Track 3', preview: 'https://example.com/3.mp3', duration: 30 },
    ];

    audioManager.play('https://example.com/1.mp3', playlist[0], playlist, 'Album', 'https://example.com/art.jpg');
    audioManager.next();

    expect(audioManager.getState().currentUrl).toBe('https://example.com/3.mp3');
  });

  it('toggles playback when playing the same URL again', () => {
    audioManager.play('https://example.com/same.mp3');
    expect(audioManager.getState().isPlaying).toBe(true);

    audioManager.play('https://example.com/same.mp3');
    expect(audioManager.getState().isPlaying).toBe(false);
  });

  it('navigates to previous playable track and no-ops at start', () => {
    const playlist = [
      { id: '1', title: 'Track 1', preview: 'https://example.com/1.mp3', duration: 30 },
      { id: '2', title: 'Track 2', preview: '', duration: 30 },
      { id: '3', title: 'Track 3', preview: 'https://example.com/3.mp3', duration: 30 },
    ];

    audioManager.play('https://example.com/3.mp3', playlist[2], playlist, 'Album', 'https://example.com/art.jpg');
    audioManager.prev();
    expect(audioManager.getState().currentUrl).toBe('https://example.com/1.mp3');

    audioManager.prev();
    expect(audioManager.getState().currentUrl).toBe('https://example.com/1.mp3');
  });

  describe('Security: Input Sanitization', () => {
    it('should reject unsafe URLs in play()', () => {
      audioManager.reset();
      // Ensure it starts null
      expect(audioManager.getState().currentUrl).toBeNull();

      audioManager.play('javascript:alert(1)');
      expect(audioManager.getState().currentUrl).toBeNull();
      expect(audioManager.getState().isPlaying).toBe(false);
    });

    it('should sanitize album metadata in play()', () => {
      const longName = 'A'.repeat(500);
      const unsafeImageUrl = 'javascript:alert(1)';

      audioManager.play('https://example.com/audio.mp3', undefined, [], longName, unsafeImageUrl);

      const state = audioManager.getState();
      expect(state.albumName?.length).toBe(200);
      expect(state.albumImageUrl).toBeNull();
    });

    it('should handle non-finite volume values', () => {
      audioManager.setVolume(Infinity);
      expect(audioManager.getState().volume).toBe(0.7);

      audioManager.setVolume(NaN);
      expect(audioManager.getState().volume).toBe(0.7);

      audioManager.setVolume(2.0); // Clamped
      expect(audioManager.getState().volume).toBe(1.0);

      audioManager.setVolume(-1.0); // Clamped
      expect(audioManager.getState().volume).toBe(0.0);
    });
  });

  describe('Performance: Optimization Checks', () => {
    it('should NOT notify subscribers when updating state with identical values', () => {
      audioManager.setVolume(0.5);
      const listener = vi.fn();
      audioManager.subscribe(listener);

      // Listener is called once upon subscription
      expect(listener).toHaveBeenCalledTimes(1);

      // Update with same volume
      audioManager.setVolume(0.5);
      expect(listener).toHaveBeenCalledTimes(1);

      // Update with different volume
      audioManager.setVolume(0.6);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should provide stable state reference for multiple calls to getState', () => {
      audioManager.setVolume(0.8);
      const s1 = audioManager.getState();
      const s2 = audioManager.getState();

      // Should be the exact same object reference
      expect(s1).toBe(s2);

      // After update, it should be a new reference
      audioManager.setVolume(0.9);
      const s3 = audioManager.getState();
      expect(s3).not.toBe(s1);
    });

    it('should provide stable state reference to subscribers', () => {
      const s1 = audioManager.getState();
      let s2: any;

      audioManager.subscribe((state) => {
        s2 = state;
      });

      // Reference should be stable (no cloning)
      expect(s1).toBe(s2);
    });
  });
});
