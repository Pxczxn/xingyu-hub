"use client";

import { Suspense } from "react";
import profileStyles from "@/components/user/user-profile.module.css";
import { UserProfilePageContent } from "@/components/user/user-profile-page";

export default function UserPage() {
  return (
    <Suspense fallback={<main className={profileStyles.loading} aria-busy="true">正在加载个人主页…</main>}>
      <UserProfilePageContent />
    </Suspense>
  );
}
