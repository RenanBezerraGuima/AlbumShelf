'use client';

import { useEffect, useRef } from 'react';
import { useFolderStore } from '@/lib/store';

export function SyncHandler() {
  const pullFromServer = useFolderStore((state) => state.pullFromServer);
  const pushToServer = useFolderStore((state) => state.pushToServer);
  const folders = useFolderStore((state) => state.folders);
  const lastFoldersRef = useRef<string>("");
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Initial pull and sync lastFoldersRef
  useEffect(() => {
    const init = async () => {
      await pullFromServer();
      // After initial pull, set the baseline to avoid immediate push
      lastFoldersRef.current = JSON.stringify(useFolderStore.getState().folders);
    };
    init();
  }, [pullFromServer]);

  // Push on changes (debounced)
  useEffect(() => {
    const currentFoldersJson = JSON.stringify(folders);

    // Skip if folders haven't changed since last sync/pull
    if (currentFoldersJson === lastFoldersRef.current) {
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      pushToServer();
      lastFoldersRef.current = currentFoldersJson;
    }, 2000); // 2 second debounce to avoid spamming the server

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [folders, pushToServer]);

  return null;
}
