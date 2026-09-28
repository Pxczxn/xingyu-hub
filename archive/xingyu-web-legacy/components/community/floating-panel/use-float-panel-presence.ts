"use client";

import { useEffect, useState } from "react";

const DEFAULT_EXIT_MS = 200;

export function useFloatPanelPresence(open: boolean, exitDuration = DEFAULT_EXIT_MS) {
  const [render, setRender] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setRender(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timer = window.setTimeout(() => setRender(false), exitDuration);
    return () => window.clearTimeout(timer);
  }, [open, exitDuration]);

  return { render, visible };
}
