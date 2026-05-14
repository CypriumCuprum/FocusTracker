import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

// Subscribe to a Tauri backend event. The handler must be stable
// (wrap in useCallback) — the subscription resets when it changes.
export function useTauriEvent(eventName, handler) {
  useEffect(() => {
    let unlisten;
    let cancelled = false;
    listen(eventName, handler).then(fn => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => { cancelled = true; unlisten?.(); };
  }, [eventName, handler]);
}
