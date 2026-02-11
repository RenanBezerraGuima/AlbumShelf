'use client';

import React, { useRef } from 'react';
import { Download, Upload, Settings, Music, Radio, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { redirectToSpotifyAuth } from '@/lib/spotify-auth';
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
import { Theme } from '@/lib/types';

export function SettingsDialog() {
  const folders = useFolderStore((state) => state.folders);
  const importFolders = useFolderStore((state) => state.importFolders);
  const streamingProvider = useFolderStore((state) => state.streamingProvider);
  const setStreamingProvider = useFolderStore((state) => state.setStreamingProvider);
  const theme = useFolderStore((state) => state.theme);
  const setTheme = useFolderStore((state) => state.setTheme);
  const spotifyToken = useFolderStore((state) => state.spotifyToken);
  const spotifyTokenExpiry = useFolderStore((state) => state.spotifyTokenExpiry);
  const spotifyTokenTimestamp = useFolderStore((state) => state.spotifyTokenTimestamp);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSpotifyConnected = React.useMemo(() => {
    if (!spotifyToken || !spotifyTokenExpiry || !spotifyTokenTimestamp) return false;
    const now = Date.now();
    return now < spotifyTokenTimestamp + (spotifyTokenExpiry * 1000);
  }, [spotifyToken, spotifyTokenExpiry, spotifyTokenTimestamp]);

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
      <DialogContent className="sm:max-w-[425px] w-[95vw] max-h-[90dvh] p-0 overflow-hidden flex flex-col">
        <div className="p-6 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage your personal data and collections.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="space-y-4">
              <h4 className="text-sm font-black uppercase tracking-tight border-b-2 border-border pb-1">
                Design Iteration
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {(['industrial', 'editorial', 'glitch', 'organic', 'refined'] as Theme[]).map((t) => (
                  <Button
                    key={t}
                    variant={theme === t ? 'default' : 'outline'}
                    className="justify-start gap-2 rounded-none h-12 relative overflow-hidden group"
                    onClick={() => setTheme(t)}
                  >
                    <span className="relative z-10 text-[10px] font-bold uppercase tracking-widest">{t}</span>
                    {theme === t && (
                      <div className="absolute inset-0 bg-primary/20 animate-pulse" />
                    )}
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-black uppercase tracking-tight border-b-2 border-border pb-1">
                Streaming Provider
              </h4>
              <div className="grid grid-cols-1 gap-2">
                <div className="grid grid-cols-2 gap-2">
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
                <div className="relative group">
                  <Button
                    variant={streamingProvider === 'spotify' ? 'default' : 'outline'}
                    className="w-full justify-start gap-2 rounded-none"
                    onClick={() => setStreamingProvider('spotify')}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm5.508 17.302c-.216.354-.674.464-1.028.248-2.812-1.718-6.352-2.106-10.518-1.154-.404.092-.81-.162-.902-.566-.092-.404.162-.81.566-.902 4.568-1.044 8.508-.6 11.634 1.312.354.216.464.674.248 1.028zm1.472-3.254c-.272.442-.848.582-1.29.31-3.22-1.978-8.124-2.554-11.928-1.398-.502.152-1.03-.132-1.182-.634-.152-.502.132-1.03.634-1.182 4.35-1.32 9.75-.672 13.456 1.606.442.27.582.848.31 1.298zm.126-3.414c-3.864-2.294-10.244-2.508-13.944-1.384-.592.18-1.218-.154-1.398-.746-.18-.592.154-1.218.746-1.398 4.256-1.292 11.298-1.044 15.748 1.6 0 .532-.18 1.158-.752 1.338-.592.182-1.218-.152-1.4-.744l.001-.166z" />
                      </svg>
                      Spotify
                    </div>
                    {isSpotifyConnected && <CheckCircle2 className="h-3 w-3 text-lime-500" />}
                  </Button>
                  {streamingProvider === 'spotify' && !isSpotifyConnected && (
                    <p className="text-[10px] font-mono mt-1 uppercase text-destructive">
                      Not connected. <button onClick={() => redirectToSpotifyAuth()} className="underline hover:text-primary cursor-pointer">Connect now</button>
                    </p>
                  )}
                </div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
