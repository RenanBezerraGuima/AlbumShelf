import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const state = {
  isGuestMode: false,
  sharedFolders: null as any,
  hydrationProgress: null as any,
  exitGuestMode: vi.fn(),
  importFolders: vi.fn(),
};

vi.mock('@/lib/store', () => ({
  useFolderStore: (selector: any) => selector(state),
}));

import { ShareBanner } from './share-banner';

describe('ShareBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.isGuestMode = false;
    state.sharedFolders = null;
    state.hydrationProgress = null;
  });

  it('renders nothing when not in guest mode', () => {
    const { container } = render(<ShareBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('imports shared folders and exits guest mode', () => {
    state.isGuestMode = true;
    state.sharedFolders = [{ id: 'f1' }, { id: 'f2' }];

    render(<ShareBanner />);
    fireEvent.click(screen.getByLabelText(/Import to my collections/i));

    expect(state.importFolders).toHaveBeenCalledWith(state.sharedFolders);
    expect(state.exitGuestMode).toHaveBeenCalledTimes(1);
  });

  it('shows hydration progress and allows exit', () => {
    state.isGuestMode = true;
    state.sharedFolders = [{ id: 'f1' }];
    state.hydrationProgress = { current: 1, total: 3 };

    render(<ShareBanner />);
    expect(screen.getByText(/Hydrating metadata: 1\/3/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Exit shared view/i));
    expect(state.exitGuestMode).toHaveBeenCalledTimes(1);
  });
});
