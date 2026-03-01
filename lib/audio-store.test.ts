import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioManager } from './audio-store';

describe('audioManager', () => {
  beforeEach(() => {
    // Reset state before each test
    audioManager.stop();
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
      { id: '1', title: 'Track 1', preview: 'url1', duration: 30 },
      { id: '2', title: 'Track 2', preview: 'url2', duration: 30 },
    ];

    audioManager.play('url1', playlist[0], playlist, 'Album', 'art');
    let state = audioManager.getState();
    expect(state.currentIndex).toBe(0);
    expect(state.currentUrl).toBe('url1');

    audioManager.next();
    state = audioManager.getState();
    expect(state.currentIndex).toBe(1);
    expect(state.currentUrl).toBe('url2');
  });

  it('should stop playback but keep metadata', () => {
    audioManager.play('url1');
    audioManager.stop();
    expect(audioManager.getState().isPlaying).toBe(false);
    expect(audioManager.getState().currentUrl).toBe('url1');
  });

  it('should publish state updates to subscribers and allow unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = audioManager.subscribe(listener);

    audioManager.play('url-a');
    expect(listener).toHaveBeenCalled();

    const callsBefore = listener.mock.calls.length;
    unsubscribe();
    audioManager.stop();
    expect(listener.mock.calls.length).toBe(callsBefore);
  });

  it('should skip tracks without preview when navigating next', () => {
    const playlist = [
      { id: '1', title: 'Track 1', preview: 'url1', duration: 30 },
      { id: '2', title: 'Track 2', preview: '', duration: 30 },
      { id: '3', title: 'Track 3', preview: 'url3', duration: 30 },
    ];

    audioManager.play('url1', playlist[0], playlist, 'Album', 'art');
    audioManager.next();

    expect(audioManager.getState().currentUrl).toBe('url3');
  });

  it('toggles playback when playing the same URL again', () => {
    audioManager.play('same-url');
    expect(audioManager.getState().isPlaying).toBe(true);

    audioManager.play('same-url');
    expect(audioManager.getState().isPlaying).toBe(false);
  });

  it('navigates to previous playable track and no-ops at start', () => {
    const playlist = [
      { id: '1', title: 'Track 1', preview: 'url1', duration: 30 },
      { id: '2', title: 'Track 2', preview: '', duration: 30 },
      { id: '3', title: 'Track 3', preview: 'url3', duration: 30 },
    ];

    audioManager.play('url3', playlist[2], playlist, 'Album', 'art');
    audioManager.prev();
    expect(audioManager.getState().currentUrl).toBe('url1');

    audioManager.prev();
    expect(audioManager.getState().currentUrl).toBe('url1');
  });
});
