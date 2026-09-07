"use client";

import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MePrototypePage } from "@/components/community/me-prototype-page";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

export default function MePage() {
  const { data, loading, error } = useAsyncData(async () => {
    const [profile, insights] = await Promise.all([
      communityApi.getMyProfile(),
      communityApi.getMyInsights().catch(() => null),
    ]);
    return { profile, insights };
  }, []);

  if (loading) {
    return (
      <AppShell>
        <main className="grid min-h-[60vh] place-items-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-[rgb(var(--violet))] motion-reduce:animate-none" />
        </main>
      </AppShell>
    );
  }

  if (!data?.profile) {
    return (
      <AppShell>
        <main className="xy-page max-w-lg">
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="xy-panel grid min-h-[50vh] place-items-center p-8 text-center">
            <div>
              <h1 className="text-2xl font-semibold text-[#23345a]">请先登录</h1>
              <p className="mt-3 text-sm text-muted-foreground">登录后即可查看个人中心、创作数据与社区活动。</p>
              <Button asChild className="mt-6 rounded-xl">
                <Link href="/login">去登录</Link>
              </Button>
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <MePrototypePage profile={data.profile} insights={data.insights} />
    </AppShell>
  );
}
