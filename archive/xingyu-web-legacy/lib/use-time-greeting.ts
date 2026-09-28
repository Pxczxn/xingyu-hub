"use client";

import { useEffect, useState } from "react";
import { getTimeGreeting, msUntilNextGreetingChange } from "@/lib/greeting";

export function useTimeGreeting() {
  const [greeting, setGreeting] = useState(() => getTimeGreeting());

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      const now = new Date();
      setGreeting(getTimeGreeting(now));
      timeoutId = setTimeout(scheduleNext, msUntilNextGreetingChange(now));
    }

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, []);

  return greeting;
}
