'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputActive = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');
      const isContentEditable = (document.activeElement as HTMLElement)?.isContentEditable;

      if (e.key.toLowerCase() === 't' && !isInputActive && !isContentEditable && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setTheme(theme === 'dark' ? 'light' : 'dark');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [theme, setTheme]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-none border-border"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme [T]"
          aria-keyshortcuts="t"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" aria-hidden="true" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="text-[10px] font-mono uppercase tracking-widest border-2 border-border brutalist-shadow-sm rounded-none">
        Toggle theme [T]
      </TooltipContent>
    </Tooltip>
  )
}
