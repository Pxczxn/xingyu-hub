"use client";

import { useCallback, useRef, useState } from "react";

/** Short grace period so the cursor can cross the hover bridge without flicker. */
const DEFAULT_CLOSE_DELAY = 90;

export function useHoverOpen(closeDelay = DEFAULT_CLOSE_DELAY) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handleEnter = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const handleLeave = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), closeDelay);
  }, [clearCloseTimer, closeDelay]);

  const forceClose = useCallback(() => {
    clearCloseTimer();
    setOpen(false);
  }, [clearCloseTimer]);

  const keepOpen = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  return { open, setOpen, handleEnter, handleLeave, forceClose, keepOpen };
}
