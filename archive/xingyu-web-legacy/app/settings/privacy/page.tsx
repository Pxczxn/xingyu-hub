"use client";

import { useEffect } from "react";
import { navigate } from "@/src/vite/router";

/** 旧路由：合并到 /settings/privacy/profile */
export default function PrivacySettingsHubPage() {
  useEffect(() => {
    navigate("/settings/privacy/profile", true);
  }, []);
  return null;
}
