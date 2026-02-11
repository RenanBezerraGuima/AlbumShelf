'use client';

import React from 'react';
import { Menu, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsDialog } from './settings-dialog';

interface MobileHeaderProps {
    onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
    return (
        <header className="h-[60px] w-full border-b-2 border-border bg-background flex items-center justify-between px-4 z-50 shrink-0">
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onMenuClick}
                    className="h-10 w-10 border-2 border-transparent hover:border-border rounded-none"
                    aria-label="Open menu"
                >
                    <Menu className="h-6 w-6" />
                </Button>
            </div>

            <h1 className="text-xl font-black uppercase tracking-tighter" style={{ fontFamily: 'var(--font-display)' }}>
                ALBUMSHELF
            </h1>

            <div className="flex items-center gap-2">
                <SettingsDialog />
            </div>
        </header>
    );
}
