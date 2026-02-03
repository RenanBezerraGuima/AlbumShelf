'use client';

import React, { useRef } from 'react';
import { Download, Upload, Settings, Music, Radio } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useFolderStore } from '@/lib/store';

export function SettingsDialog() {
  const folders = useFolderStore((state) => state.folders);
  const importFolders = useFolderStore((state) => state.importFolders);
  const streamingProvider = useFolderStore((state) => state.streamingProvider);
  const setStreamingProvider = useFolderStore((state) => state.setStreamingProvider);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      const data = JSON.stringify(folders, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = format(new Date(), 'dd-MM-yyyy');
      link.href = url;
      link.download = `backup-${date}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Backup exported successfully');
    } catch (error) {
      toast.error('Failed to export backup');
      console.error(error);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const json = JSON.parse(content);

        if (!Array.isArray(json)) {
          throw new Error('Invalid format: Expected an array of collections');
        }

        importFolders(json);
        toast.success('Data merged successfully (OLD/NEW naming applied where needed)');

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        toast.error('Failed to import backup: ' + (error instanceof Error ? error.message : 'Invalid JSON'));
        console.error(error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-none border-border"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your personal data and collections.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <h4 className="text-sm font-black uppercase tracking-tight border-b-2 border-border pb-1">
              Streaming Provider
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={streamingProvider === 'deezer' ? 'default' : 'outline'}
                className="justify-start gap-2 rounded-none"
                onClick={() => setStreamingProvider('deezer')}
              >
                <Radio className="h-4 w-4" />
                Deezer
              </Button>
              <Button
                variant={streamingProvider === 'apple' ? 'default' : 'outline'}
                className="justify-start gap-2 rounded-none"
                onClick={() => setStreamingProvider('apple')}
              >
                <Music className="h-4 w-4" />
                Apple Music
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-black uppercase tracking-tight border-b-2 border-border pb-1">
              Data Management
            </h4>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-mono uppercase text-muted-foreground">
                  Export your collections and albums to a JSON file for backup.
                </p>
                <Button
                  onClick={handleExport}
                  className="w-full justify-start gap-2"
                  variant="default"
                >
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-mono uppercase text-muted-foreground">
                  Import data from a backup file. Existing collections with the same name will be kept and renamed.
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full justify-start gap-2"
                  variant="outline"
                >
                  <Upload className="h-4 w-4" />
                  Import Data
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImport}
                  accept=".json"
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 opacity-50">
             <h4 className="text-sm font-black uppercase tracking-tight border-b-2 border-border pb-1">
              About
            </h4>
            <p className="text-[10px] font-mono uppercase">
              AlbumShelf v0.1.0
              <br />
              Local-first storage
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
