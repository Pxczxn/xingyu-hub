"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AUTH_CHANGED_EVENT, hasStoredSession } from "@/lib/api-client";
import { communityApi } from "@/lib/community-api";
import { isValidUsername } from "@/lib/paths";

export type CurrentProfile = {
  username?: string;
  displayName?: string | null;
  avatar?: string | null;
  loading: boolean;
  authenticated: boolean;
};

const defaultProfile: CurrentProfile = { loading: true, authenticated: false };

const CurrentProfileContext = createContext<CurrentProfile>(defaultProfile);

export function CurrentProfileProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<CurrentProfile>(defaultProfile);

  const refreshProfile = useCallback(async () => {
    if (!hasStoredSession()) {
      setProfile({ loading: false, authenticated: false });
      return;
    }

    setProfile((current) => ({ ...current, loading: true, authenticated: true }));

    try {
      const result = await communityApi.tryGetMyProfile();
      if (!result) {
        setProfile({ loading: false, authenticated: hasStoredSession() });
        return;
      }

      const username = isValidUsername(result.username) ? result.username.trim() : undefined;
      setProfile({
        username,
        displayName: result.displayName,
        avatar: result.avatar,
        loading: false,
        authenticated: Boolean(username) || hasStoredSession(),
      });
    } catch {
      setProfile({ loading: false, authenticated: hasStoredSession() });
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [pathname, refreshProfile]);

  useEffect(() => {
    const handleAuthChanged = () => {
      void refreshProfile();
    };

    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
  }, [refreshProfile]);

  return <CurrentProfileContext.Provider value={profile}>{children}</CurrentProfileContext.Provider>;
}

export function useCurrentProfile() {
  return useContext(CurrentProfileContext);
}
