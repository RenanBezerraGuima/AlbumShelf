'use client';

import React, { useRef, memo, useState, useCallback, useEffect } from 'react';
import { Download, Upload, Settings, Music, Radio, CheckCircle2, Share2, Check, AlertTriangle, LogOut, Link2, Unlink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { redirectToSpotifyAuth } from '@/lib/spotify-auth';
import { generateShareUrl } from '@/lib/share-service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { findFolder, useFolderStore } from '@/lib/store';
import { Theme } from '@/lib/types';
import { cn } from '@/lib/utils';

function formatDateForExport(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function getShareUrlInfo() {
  try {
    const { folders, streamingProvider } = useFolderStore.getState();
    const url = generateShareUrl(folders, streamingProvider);
    return { url, length: url.length };
  } catch {
    return { url: '', length: 0 };
  }
}

interface SettingsDialogProps {
  userEmail?: string | null;
  accessToken?: string | null;
  onSignOut?: () => Promise<void> | void;
}

interface DeezerConnectionStatus {
  connected: boolean;
  status: 'connected' | 'expired' | 'invalid' | 'not_connected';
  arlHint: string | null;
  deezerUserId: string | null;
  lastVerifiedAt: string | null;
  updatedAt: string | null;
}

const defaultDeezerStatus: DeezerConnectionStatus = {
  connected: false,
  status: 'not_connected',
  arlHint: null,
  deezerUserId: null,
  lastVerifiedAt: null,
  updatedAt: null,
};

export const SettingsDialog = memo(function SettingsDialog({
  userEmail,
  accessToken,
  onSignOut,
}: SettingsDialogProps) {
  const [isExported, setIsExported] = useState(false);
  const [isImported, setIsImported] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [shareUrlInfo, setShareUrlInfo] = useState({ url: '', length: 0 });
  const [deezerArl, setDeezerArl] = useState('');
  const [deezerStatus, setDeezerStatus] = useState<DeezerConnectionStatus>(defaultDeezerStatus);
  const [isDeezerBusy, setIsDeezerBusy] = useState(false);
  const [deezerPlaylistName, setDeezerPlaylistName] = useState('');
  const [isDeezerExporting, setIsDeezerExporting] = useState(false);
  const [isDeezerImporting, setIsDeezerImporting] = useState(false);

  /**
   * Performance: Granular subscriptions and useShallow prevent the SettingsDialog
   * from re-rendering whenever the entire folder tree changes (e.g., adding an album).
   */
  const {
    isOpen,
    streamingProvider,
    theme,
    geistFont,
    spotifyToken,
    spotifyTokenExpiry,
    spotifyTokenTimestamp,
    selectedFolderId,
    selectedFolder,
  } = useFolderStore(useShallow((state) => ({
    isOpen: state.isSettingsOpen,
    streamingProvider: state.streamingProvider,
    theme: state.theme,
    geistFont: state.geistFont,
    spotifyToken: state.spotifyToken,
    spotifyTokenExpiry: state.spotifyTokenExpiry,
    spotifyTokenTimestamp: state.spotifyTokenTimestamp,
    selectedFolderId: state.selectedFolderId,
    selectedFolder: state.selectedFolderId
      ? findFolder(state.sharedFolders ?? state.folders, state.selectedFolderId)
      : null,
  })));

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSpotifyConnected = React.useMemo(() => {
    if (!spotifyToken || !spotifyTokenExpiry || !spotifyTokenTimestamp) return false;
    const now = Date.now();
    return now < spotifyTokenTimestamp + (spotifyTokenExpiry * 1000);
  }, [spotifyToken, spotifyTokenExpiry, spotifyTokenTimestamp]);

  // Global keyboard shortcut for settings (S)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputActive = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');
      const isContentEditable = (document.activeElement as HTMLElement)?.isContentEditable;

      if (e.key.toLowerCase() === 's' && !isInputActive && !isContentEditable && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        useFolderStore.getState().setSettingsOpen(!useFolderStore.getState().isSettingsOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setShareUrlInfo({ url: '', length: 0 });
      return;
    }

    const compute = () => setShareUrlInfo(getShareUrlInfo());
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(compute);
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(compute, 0);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  const fetchDeezerStatus = useCallback(async () => {
    if (!accessToken) return;

    setIsDeezerBusy(true);
    try {
      const response = await fetch('/api/deezer/connection', {
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load Deezer connection');
      }
      setDeezerStatus(data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load Deezer connection');
    } finally {
      setIsDeezerBusy(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isOpen || !accessToken) return;
    fetchDeezerStatus();
  }, [fetchDeezerStatus, isOpen, accessToken]);

  useEffect(() => {
    if (!selectedFolder) return;
    setDeezerPlaylistName((currentName) => currentName || `AlbumShelf - ${selectedFolder.name}`);
  }, [selectedFolder]);

  const handleConnectDeezer = useCallback(async () => {
    const arl = deezerArl.trim();
    if (!accessToken || !arl || isDeezerBusy) return;

    setIsDeezerBusy(true);
    try {
      const response = await fetch('/api/deezer/connection', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ arl }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to connect Deezer');
      }

      setDeezerStatus(data);
      setDeezerArl('');
      toast.success('Deezer connected');
    } catch (error) {
      console.error(error);
      toast.error('Failed to connect Deezer', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsDeezerBusy(false);
    }
  }, [accessToken, deezerArl, isDeezerBusy]);

  const handleDisconnectDeezer = useCallback(async () => {
    if (!accessToken || isDeezerBusy) return;

    setIsDeezerBusy(true);
    try {
      const response = await fetch('/api/deezer/connection', {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to disconnect Deezer');
      }

      setDeezerStatus(data);
      toast.success('Deezer disconnected');
    } catch (error) {
      console.error(error);
      toast.error('Failed to disconnect Deezer');
    } finally {
      setIsDeezerBusy(false);
    }
  }, [accessToken, isDeezerBusy]);

  const deezerExportAlbums = React.useMemo(
    () => selectedFolder?.albums.filter((album) => album.id.startsWith('deezer-')) ?? [],
    [selectedFolder],
  );

  const handleExportDeezerPlaylist = useCallback(async () => {
    if (
      !accessToken ||
      !selectedFolder ||
      !deezerStatus.connected ||
      deezerExportAlbums.length === 0 ||
      isDeezerExporting
    ) {
      return;
    }

    setIsDeezerExporting(true);
    try {
      const response = await fetch('/api/deezer/export-playlist', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          playlistName: deezerPlaylistName.trim() || `AlbumShelf - ${selectedFolder.name}`,
          albums: selectedFolder.albums.map((album) => ({
            id: album.id,
            name: album.name,
            artist: album.artist,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to export Deezer playlist');
      }

      toast.success('Deezer playlist created', {
        description: `${data.trackCount} tracks exported from ${data.deezerAlbumCount} albums.`,
      });

      if (typeof data.playlistUrl === 'string') {
        window.open(data.playlistUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to export Deezer playlist', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsDeezerExporting(false);
    }
  }, [
    accessToken,
    deezerExportAlbums.length,
    deezerPlaylistName,
    deezerStatus.connected,
    isDeezerExporting,
    selectedFolder,
  ]);

  const handleImportDeezerFavorites = useCallback(async () => {
    if (!accessToken || !deezerStatus.connected || isDeezerImporting) return;

    setIsDeezerImporting(true);
    try {
      const response = await fetch('/api/deezer/favorites', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to import Deezer favorites');
      }

      const albums = Array.isArray(data.albums) ? data.albums : [];
      if (albums.length === 0) {
        toast.info('No favorite albums found on Deezer.');
        return;
      }

      const store = useFolderStore.getState();

      store.importFolders([{
        id: crypto.randomUUID(),
        name: 'Deezer Favorites',
        parentId: null,
        albums: albums,
        subfolders: [],
        isExpanded: true,
        viewMode: 'grid',
      }]);

      toast.success('Deezer favorites imported', {
        description: `${albums.length} albums added to "Deezer Favorites" collection.`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Failed to import Deezer favorites', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsDeezerImporting(false);
    }
  }, [accessToken, deezerStatus.connected, isDeezerImporting]);

  /**
   * Performance: Accessing large state slices (like 'folders') only inside event handlers
   * using getState() instead of subscribing to them prevents re-rendering the component
   * on every change to that state.
   */
  const handleExport = () => {
    try {
      const { folders } = useFolderStore.getState();
      const data = JSON.stringify(folders, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = formatDateForExport(new Date());
      link.href = url;
      link.download = `backup-${date}.json`;
      link.click();
      URL.revokeObjectURL(url);

      setIsExported(true);
      setTimeout(() => setIsExported(false), 2000);

      toast.success('Data exported successfully!', {
        description: `Backup saved as backup-${date}.json`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Failed to export data');
    }
  };

  const handleShare = useCallback(async () => {
    try {
      const nextShareUrlInfo = shareUrlInfo.url ? shareUrlInfo : getShareUrlInfo();
      if (!nextShareUrlInfo.url) return;
      setShareUrlInfo(nextShareUrlInfo);
      await navigator.clipboard.writeText(nextShareUrlInfo.url);

      setIsShared(true);
      setTimeout(() => setIsShared(false), 2000);

      toast.success('Share link copied!', {
        description: 'You can now share your collection with others.',
      });
    } catch (error) {
      console.error('Failed to copy share URL:', error);
      toast.error('Failed to copy share link');
    }
  }, [shareUrlInfo]);

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

        useFolderStore.getState().importFolders(json);

        setIsImported(true);
        setTimeout(() => setIsImported(false), 2000);

        toast.success('Data imported successfully!', {
          description: `${json.length} collections added to your shelf.`,
        });

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error(error);
        toast.error('Failed to import data');
      }
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => useFolderStore.getState().setSettingsOpen(open)}>
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
              <h4 className="text-sm font-medium tracking-tight border-b-2 border-border pb-1">
                Design iteration
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {(['industrial', 'editorial', 'organic', 'refined', 'mint'] as Theme[]).map((t) => (
                  <Button
                    key={t}
                    variant={theme === t ? 'default' : 'outline'}
                    className="justify-start gap-2 rounded-none h-12 relative overflow-hidden group"
                    onClick={() => useFolderStore.getState().setTheme(t)}
                    aria-pressed={theme === t}
                  >
                    <span className="relative z-10 text-[10px] font-medium tracking-widest capitalize">{t}</span>
                    {theme === t && (
                      <div className="absolute inset-0 bg-primary/20 animate-pulse" />
                    )}
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                  </Button>
                ))}
              </div>
            </div>


            <div className="space-y-4">
              <h4 className="text-sm font-medium tracking-tight border-b-2 border-border pb-1">
                Streaming provider
              </h4>
              <div className="grid grid-cols-1 gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={streamingProvider === 'deezer' ? 'default' : 'outline'}
                    className="justify-start gap-2 rounded-none"
                    onClick={() => useFolderStore.getState().setStreamingProvider('deezer')}
                    aria-pressed={streamingProvider === 'deezer'}
                  >
                    <Radio className="h-4 w-4" />
                    Deezer
                  </Button>
                  <Button
                    variant={streamingProvider === 'apple' ? 'default' : 'outline'}
                    className="justify-start gap-2 rounded-none"
                    onClick={() => useFolderStore.getState().setStreamingProvider('apple')}
                    aria-pressed={streamingProvider === 'apple'}
                  >
                    <Music className="h-4 w-4" />
                    Apple Music
                  </Button>
                </div>
                <div className="relative group">
                  <Button
                    variant={streamingProvider === 'spotify' ? 'default' : 'outline'}
                    className="w-full justify-start gap-2 rounded-none"
                    onClick={() => useFolderStore.getState().setStreamingProvider('spotify')}
                    aria-pressed={streamingProvider === 'spotify'}
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
                    <p className="text-[10px] font-mono mt-1 text-destructive">
                      Not connected. <button onClick={() => redirectToSpotifyAuth()} className="underline hover:text-primary cursor-pointer">Connect now</button>
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 border-t border-border/60 pt-3">
                <div className="flex items-center justify-between gap-3 text-xs font-mono">
                  <span className="text-muted-foreground">Selected collection</span>
                  <span className="max-w-[220px] truncate">
                    {selectedFolder?.name ?? 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-muted-foreground">
                  <span>Deezer albums</span>
                  <span>
                    {deezerExportAlbums.length}
                    {selectedFolder ? ` / ${selectedFolder.albums.length}` : ''}
                  </span>
                </div>
                <Input
                  value={deezerPlaylistName}
                  onChange={(event) => setDeezerPlaylistName(event.target.value)}
                  placeholder="Playlist name"
                  className="rounded-none font-mono text-xs"
                  disabled={!deezerStatus.connected || isDeezerExporting}
                />
                <Button
                  type="button"
                  onClick={handleExportDeezerPlaylist}
                  className="w-full justify-start gap-2 rounded-none"
                  variant="outline"
                  disabled={
                    !accessToken ||
                    !selectedFolderId ||
                    !deezerStatus.connected ||
                    deezerExportAlbums.length === 0 ||
                    isDeezerExporting
                  }
                >
                  <Upload className="h-4 w-4" />
                  {isDeezerExporting ? 'Exporting playlist...' : 'Export Collection to Deezer Playlist'}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b-2 border-border pb-1">
                <h4 className="text-sm font-medium tracking-tight">
                  Deezer account sync
                </h4>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-none"
                  onClick={fetchDeezerStatus}
                  disabled={!accessToken || isDeezerBusy}
                  aria-label="Refresh Deezer status"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isDeezerBusy && "animate-spin")} />
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs font-mono">
                  <span className="text-muted-foreground">Status</span>
                  <span className={cn(
                    "uppercase",
                    deezerStatus.connected ? "text-lime-500" : "text-muted-foreground"
                  )}>
                    {deezerStatus.status.replace('_', ' ')}
                  </span>
                </div>
                {deezerStatus.connected && (
                  <div className="grid gap-1 text-[10px] font-mono text-muted-foreground">
                    <div className="flex justify-between gap-3">
                      <span>ARL</span>
                      <span>{deezerStatus.arlHint}</span>
                    </div>
                    {deezerStatus.deezerUserId && (
                      <div className="flex justify-between gap-3">
                        <span>Deezer ID</span>
                        <span>{deezerStatus.deezerUserId}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Input
                  value={deezerArl}
                  onChange={(event) => setDeezerArl(event.target.value)}
                  placeholder="Paste Deezer ARL"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  className="rounded-none font-mono text-xs"
                  disabled={!accessToken || isDeezerBusy}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    onClick={handleConnectDeezer}
                    className="justify-start gap-2 rounded-none"
                    disabled={!accessToken || !deezerArl.trim() || isDeezerBusy}
                  >
                    <Link2 className="h-4 w-4" />
                    Connect
                  </Button>
                  <Button
                    type="button"
                    onClick={handleDisconnectDeezer}
                    className="justify-start gap-2 rounded-none"
                    variant="outline"
                    disabled={!accessToken || !deezerStatus.connected || isDeezerBusy}
                  >
                    <Unlink className="h-4 w-4" />
                    Disconnect
                  </Button>
                </div>
              </div>

              <div className="space-y-2 border-t border-border/60 pt-3">
                <Button
                  type="button"
                  onClick={handleImportDeezerFavorites}
                  className="w-full justify-start gap-2 rounded-none"
                  variant="outline"
                  disabled={!accessToken || !deezerStatus.connected || isDeezerImporting}
                >
                  <Download className={cn("h-4 w-4", isDeezerImporting && "animate-pulse")} />
                  {isDeezerImporting ? 'Importing favorites...' : 'Import Hearted Albums'}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium tracking-tight border-b-2 border-border pb-1">
                Account
              </h4>
              <div className="space-y-2">
                <p className="text-xs font-mono text-muted-foreground">
                  Signed in as {userEmail || 'unknown user'}.
                </p>
                <Button
                  onClick={() => onSignOut?.()}
                  className="w-full justify-start gap-2 rounded-none"
                  variant="outline"
                  disabled={!onSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium tracking-tight border-b-2 border-border pb-1">
                Data management
              </h4>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-mono text-muted-foreground">
                      Create a shareable link for your current shelf.
                    </p>
                    {shareUrlInfo.length > 0 && (
                      <span className={cn(
                        "text-[9px] font-mono",
                        shareUrlInfo.length > 7000 ? "text-destructive font-bold" : "text-muted-foreground"
                      )}>
                        {shareUrlInfo.length} chars
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={handleShare}
                    className={cn(
                      "w-full justify-start gap-2 rounded-none brutalist-shadow-sm transition-all duration-300",
                      isShared ? "bg-green-600 hover:bg-green-700" : "bg-primary hover:bg-primary/90"
                    )}
                    variant="default"
                    disabled={!shareUrlInfo.url}
                    aria-label={isShared ? "Link copied!" : "Share Shelf Link"}
                  >
                    {isShared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                    {isShared ? "Link Copied!" : "Share Shelf Link"}
                  </Button>
                  {shareUrlInfo.length > 8000 && (
                    <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/20 mt-1">
                      <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                      <p className="text-[9px] text-destructive leading-tight font-mono uppercase">
                        Link may be too long for some browsers ({shareUrlInfo.length} chars). Consider exporting as file if it fails.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-mono text-muted-foreground">
                    Export your collections and albums to a JSON file for backup.
                  </p>
                  <Button
                    onClick={handleExport}
                    className={cn(
                      "w-full justify-start gap-2 transition-all duration-300",
                      isExported && "border-green-600 text-green-600"
                    )}
                    variant="outline"
                    aria-label={isExported ? "Data exported!" : "Export Data"}
                  >
                    {isExported ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                    {isExported ? "Data Exported!" : "Export Data"}
                  </Button>
                </div>

                <div className="space-y-2 opacity-80">
                  <p className="text-xs font-mono text-muted-foreground">
                    Import data from a backup file. Existing collections with the same name will be kept and renamed.
                  </p>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "w-full justify-start gap-2 transition-all duration-300",
                      isImported && "border-green-600 text-green-600"
                    )}
                    variant="outline"
                    aria-label={isImported ? "Data imported!" : "Import Data"}
                  >
                    {isImported ? <Check className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                    {isImported ? "Data Imported!" : "Import Data"}
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

            <div className="space-y-4">
              <h4 className="text-sm font-medium tracking-tight border-b-2 border-border pb-1">
                Keyboard shortcuts
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-mono uppercase tracking-tighter">
                <div className="flex justify-between items-center border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">Search</span>
                  <span className="bg-muted px-1 border border-border">/</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">New Collection</span>
                  <span className="bg-muted px-1 border border-border">N</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">Toggle Settings</span>
                  <span className="bg-muted px-1 border border-border">S</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">Toggle Theme</span>
                  <span className="bg-muted px-1 border border-border">T</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">Share</span>
                  <span className="bg-muted px-1 border border-border">C</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">Play / Pause</span>
                  <span className="bg-muted px-1 border border-border">Space</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">Prev / Next</span>
                  <span className="bg-muted px-1 border border-border">[ / ]</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">Stop / Mute</span>
                  <span className="bg-muted px-1 border border-border">X / M</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">Grid / Canvas</span>
                  <span className="bg-muted px-1 border border-border">G / V</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">Volume</span>
                  <span className="bg-muted px-1 border border-border">+ / -</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 opacity-50">
              <h4 className="text-sm font-medium tracking-tight border-b-2 border-border pb-1">
                About
              </h4>
              <p className="text-[10px] font-mono">
                AlbumShelf v0.1.0
                <br />
                Supabase account sync
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
