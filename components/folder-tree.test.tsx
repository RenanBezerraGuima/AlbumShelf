import { render, screen, fireEvent } from '@testing-library/react';
import { FolderTree } from './folder-tree';
import { useFolderStore } from '@/lib/store';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the store
vi.mock('@/lib/store', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useFolderStore: vi.fn(),
  };
});

describe('FolderTree Search', () => {
  const mockFolders = [
    {
      id: '1',
      name: 'Rock Classics',
      albums: [
        { id: 'a1', name: 'Led Zeppelin IV', artist: 'Led Zeppelin' },
        { id: 'a2', name: 'Paranoid', artist: 'Black Sabbath' },
      ],
      subfolders: [],
      isExpanded: false,
    },
    {
      id: '2',
      name: 'Jazz Essentials',
      albums: [
        { id: 'a3', name: 'Kind of Blue', artist: 'Miles Davis' },
      ],
      subfolders: [
        {
          id: '3',
          name: 'Fusion',
          albums: [{ id: 'a4', name: 'Bitches Brew', artist: 'Miles Davis' }],
          subfolders: [],
          isExpanded: false,
        }
      ],
      isExpanded: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useFolderStore as any).mockImplementation((selector: any) =>
      selector({
        folders: mockFolders,
        sharedFolders: null,
        draggedFolder: null,
        selectedFolderId: null,
      })
    );
  });

  it('filters folders by name', () => {
    render(<FolderTree />);
    const searchInput = screen.getByPlaceholderText('Search collections...');

    fireEvent.change(searchInput, { target: { value: 'Rock' } });

    expect(screen.getByText('Rock Classics')).toBeDefined();
    expect(screen.queryByText('Jazz Essentials')).toBeNull();
  });

  it('filters folders by artist name', () => {
    render(<FolderTree />);
    const searchInput = screen.getByPlaceholderText('Search collections...');

    fireEvent.change(searchInput, { target: { value: 'Miles Davis' } });

    expect(screen.getByText('Jazz Essentials')).toBeDefined();
    expect(screen.getByText('Fusion')).toBeDefined();
    expect(screen.queryByText('Rock Classics')).toBeNull();
  });

  it('filters folders by album name', () => {
    render(<FolderTree />);
    const searchInput = screen.getByPlaceholderText('Search collections...');

    fireEvent.change(searchInput, { target: { value: 'Paranoid' } });

    expect(screen.getByText('Rock Classics')).toBeDefined();
    expect(screen.queryByText('Jazz Essentials')).toBeNull();
  });

  it('shows clear button when searching and clears search when clicked', () => {
    render(<FolderTree />);
    const searchInput = screen.getByPlaceholderText('Search collections...');

    fireEvent.change(searchInput, { target: { value: 'Rock' } });

    const clearButton = screen.getByLabelText('Clear search');
    fireEvent.click(clearButton);

    expect((searchInput as HTMLInputElement).value).toBe('');
    expect(screen.getByText('Rock Classics')).toBeDefined();
    expect(screen.getByText('Jazz Essentials')).toBeDefined();
  });

  it('shows no results message when no matches are found', () => {
    render(<FolderTree />);
    const searchInput = screen.getByPlaceholderText('Search collections...');

    fireEvent.change(searchInput, { target: { value: 'Nonexistent' } });

    expect(screen.getByText(/No results for "Nonexistent"/)).toBeDefined();
    expect(screen.queryByText('Rock Classics')).toBeNull();
  });
});
