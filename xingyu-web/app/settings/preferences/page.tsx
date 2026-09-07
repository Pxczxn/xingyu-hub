"use client";

import { FormEvent, useEffect, useState } from "react";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getUserPreferences, hydrateClientSettingsFromServer, saveUserPreferences, type UserPreferences } from "@/lib/user-preferences";

export default function PreferencesSettingsPage() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void hydrateClientSettingsFromServer().then(() => setPrefs(getUserPreferences()));
  }, []);

  function toggle(key: keyof UserPreferences) {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: !prefs[key] });
    setSaved(false);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!prefs) return;
    saveUserPreferences(prefs);
    setSaved(true);
  }

  return (
    <CompactPageShell eyebrow="账户" title="偏好与无障碍" description="界面显示与动效偏好" width="lg" backHref="/settings" backLabel="返回设置" className="xy-preferences-page">
      {!prefs ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <div className="xy-preferences-grid">
          <Card className="xy-preferences-card">
            <div className="xy-preferences-card-heading">
              <div>
                <CardTitle>界面偏好</CardTitle>
                <CardDescription className="mt-1">与账号同步保存，并在本设备缓存以加快加载</CardDescription>
              </div>
              <span className="xy-preferences-status">可随时调整</span>
            </div>
            <form className="mt-5 space-y-3" onSubmit={onSubmit}>
            <label className="xy-preference-option">
              <span><strong>紧凑模式</strong><small>减少列表间距，适合快速浏览更多内容</small></span>
              <input aria-label="紧凑模式" type="checkbox" checked={prefs.compactMode} onChange={() => toggle("compactMode")} />
            </label>
            <label className="xy-preference-option">
              <span><strong>减少动效</strong><small>降低页面过渡与装饰动画，减少视觉干扰</small></span>
              <input aria-label="减少动效" type="checkbox" checked={prefs.reduceMotion} onChange={() => toggle("reduceMotion")} />
            </label>
            {saved && <Alert>偏好已保存</Alert>}
              <div className="xy-preferences-actions"><Button type="submit">保存偏好</Button></div>
            </form>
          </Card>
          <aside className="xy-preferences-note">
            <div className="xy-preferences-note-icon" aria-hidden="true">✦</div>
            <p className="xy-preferences-note-kicker">舒适阅读</p>
            <h2>让社区更贴合你的节奏</h2>
            <p>偏好会同步到当前账号，并在下次打开社区时自动生效。你可以随时回来调整阅读密度和动效体验。</p>
            <div className="xy-preferences-note-rule" />
            <span>设置会立即保存到本设备</span>
          </aside>
        </div>
      )}
    </CompactPageShell>
  );
}
