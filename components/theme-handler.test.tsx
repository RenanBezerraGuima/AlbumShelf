import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';

const state = { theme: 'industrial' };

vi.mock('@/lib/store', () => ({
  useFolderStore: (selector: any) => selector(state),
}));

import { ThemeHandler } from './theme-handler';

describe('ThemeHandler', () => {
  beforeEach(() => {
    document.body.className = 'foo theme-old bar';
  });

  it('replaces previous theme class on body', () => {
    state.theme = 'mint';
    render(<ThemeHandler />);

    expect(document.body.className).toContain('foo');
    expect(document.body.className).toContain('bar');
    expect(document.body.className).toContain('theme-mint');
    expect(document.body.className).not.toContain('theme-old');
  });
});
