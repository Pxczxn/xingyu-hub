"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { requestOpenMessagePanel } from "@/lib/message-panel";

export default function MessagesPage() {
  const router = useRouter();

  useEffect(() => {
    requestOpenMessagePanel();
    router.replace("/");
  }, [router]);

  return null;
}
