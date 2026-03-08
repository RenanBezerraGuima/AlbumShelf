import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { state, useFolderStoreMock } = vi.hoisted(() => {
  const mockState = {
    folders: [] as any[],
    hasSetPreference: false,
    isGuestMode: false,
    setStreamingProvider: vi.fn(),
    setHasSetPreference: vi.fn(),
  };

  const hook: any = (selector?: (state: typeof mockState) => unknown) =>
    selector ? selector(mockState) : mockState;

  hook.getState = () => mockState;

  return {
    state: mockState,
    useFolderStoreMock: hook,
  };
});

vi.mock('@/lib/store', () => ({
  useFolderStore: useFolderStoreMock,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => <div data-open={String(open)}>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

import { FirstTimeSetup } from './first-time-setup';

describe('FirstTimeSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.folders = [];
    state.hasSetPreference = false;
    state.isGuestMode = false;
  });

  it('opens and sets provider choice for new user', async () => {
    render(<FirstTimeSetup />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to AlbumShelf')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Deezer' }));
    expect(state.setStreamingProvider).toHaveBeenCalledWith('deezer');
    expect(state.setHasSetPreference).toHaveBeenCalledWith(true);
  });

  it('marks preference as set for legacy user with albums', async () => {
    state.folders = [
      {
        id: 'f1',
        albums: [{ id: 'a1' }],
        subfolders: [],
      },
    ];

    render(<FirstTimeSetup />);

    await waitFor(() => {
      expect(state.setHasSetPreference).toHaveBeenCalledWith(true);
    });
  });
});
