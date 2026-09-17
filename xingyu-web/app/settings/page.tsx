"use client";

import { useEffect } from "react";
import { navigate } from "@/src/vite/router";

/** 旧路由：设置首页合并到公开资料 */
export default function SettingsRedirectPage() {
  useEffect(() => {
    navigate("/settings/profile", true);
  }, []);
  return null;
}
