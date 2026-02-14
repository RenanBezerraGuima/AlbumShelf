'use client';

import { useCallback, useRef, useEffect } from 'react';

export function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback);

  // Update the ref to the latest callback on every render.
  // This allows the stable debounced function to always call the latest logic.
  callbackRef.current = callback;

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timeout on unmount to prevent memory leaks and state updates on unmounted components.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}
