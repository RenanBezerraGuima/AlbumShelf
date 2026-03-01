import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const setTheme = vi.fn();
const themeState = { theme: 'dark' };

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: themeState.theme, setTheme }),
}));

import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    themeState.theme = 'dark';
  });

  it('toggles theme on click', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: /toggle theme/i }));
    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('toggles theme via keyboard shortcut', () => {
    render(<ThemeToggle />);
    fireEvent.keyDown(window, { key: 't' });
    expect(setTheme).toHaveBeenCalledWith('light');
  });
});
