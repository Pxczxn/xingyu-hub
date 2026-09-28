"use client";

import { useEffect } from "react";
import { navigate } from "@/src/vite/router";

/** 旧路由：合并到 /settings/profile (SET-02) */
export default function AccountSettingsRedirectPage() {
  useEffect(() => {
    navigate("/settings/profile", true);
  }, []);
  return null;
}
