"use client";

import { Suspense } from "react";
import { UserProfilePageContent } from "@/components/user/user-profile-page";

export default function UserPage() {
  return (
    <Suspense fallback={<main className="xy-profile-loading" aria-busy="true">正在加载个人主页…</main>}>
      <UserProfilePageContent />
    </Suspense>
  );
}
