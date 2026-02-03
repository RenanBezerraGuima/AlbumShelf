import { describe, it, expect, beforeEach } from 'vitest';
import { useFolderStore } from './store';

describe('useFolderStore settings', () => {
  beforeEach(() => {
    useFolderStore.setState({
      folders: [],
      selectedFolderId: null,
      streamingProvider: 'deezer',
      hasSetPreference: false
    });
  });

  it('should have default streaming provider as deezer', () => {
    const state = useFolderStore.getState();
    expect(state.streamingProvider).toBe('deezer');
    expect(state.hasSetPreference).toBe(false);
  });

  it('should update streaming provider', () => {
    const { setStreamingProvider } = useFolderStore.getState();
    setStreamingProvider('apple');

    const state = useFolderStore.getState();
    expect(state.streamingProvider).toBe('apple');
  });

  it('should update hasSetPreference', () => {
    const { setHasSetPreference } = useFolderStore.getState();
    setHasSetPreference(true);

    const state = useFolderStore.getState();
    expect(state.hasSetPreference).toBe(true);
  });
});
