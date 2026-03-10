import { describe, it, expect, beforeEach } from 'vitest';
import { useFolderStore } from './store';

describe('useFolderStore folder sanitization', () => {
  beforeEach(() => {
    // Reset the store before each test
    useFolderStore.setState({ folders: [], selectedFolderId: null, sharedFolders: null });
  });

  it('createFolder should strip control characters and handle empty names', () => {
    const { createFolder } = useFolderStore.getState();

    // Test control characters
    const nameWithControl = 'Test\nFolder\r';
    createFolder(nameWithControl, null);

    let folders = useFolderStore.getState().folders;
    expect(folders).toHaveLength(1);
    // Verified behavior: control characters are stripped
    expect(folders[0].name).toBe('TestFolder');

    // Test empty name
    createFolder('', null);
    folders = useFolderStore.getState().folders;
    expect(folders).toHaveLength(2);
    // Verified behavior: defaults to 'Untitled'
    expect(folders[1].name).toBe('Untitled');
  });

  it('renameFolder should strip control characters', () => {
    const { createFolder, renameFolder } = useFolderStore.getState();

    createFolder('Initial Name', null);
    const folderId = useFolderStore.getState().folders[0].id;

    const nameWithControl = 'New\tName\x00';
    renameFolder(folderId, nameWithControl);

    const folders = useFolderStore.getState().folders;
    // Verified behavior: control characters are stripped
    expect(folders[0].name).toBe('NewName');
  });
});
