'use client';

import { useEffect } from 'react';
import { useFolderStore } from '@/lib/store';

export function ThemeHandler() {
  const theme = useFolderStore((state) => state.theme);

  useEffect(() => {
    // Remove all existing theme classes
    const classes = document.body.className.split(' ').filter(c => !c.startsWith('theme-'));
    document.body.className = [...classes, `theme-${theme}`].join(' ');
  }, [theme]);

  return null;
}
