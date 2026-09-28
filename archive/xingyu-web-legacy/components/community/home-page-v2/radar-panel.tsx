"use client";

import { useState } from "react";
import Link from "next/link";
import { Hash, Orbit, Megaphone, PenLine, Bookmark, Clock3, FileEdit, TrendingUp } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { formatDateTime } from "@/lib/format";
import type { TopicSummary, GalaxySummary, AnnouncementSummary } from "@/lib/community-api";
import styles from "./radar-panel.module.css";

type RadarPanelProps = {
  topics: TopicSummary[];
  galaxies: GalaxySummary[];
  announcements: AnnouncementSummary[];
  isGuest: boolean;
};

/**
 * 右侧雷达面板
 * 聚合显示话题、星系、公告和快捷方式
 */
export function RadarPanel({ topics, galaxies, announcements, isGuest }: RadarPanelProps) {
  const [activeTab, setActiveTab] = useState("topics");

  return (
    <aside className={styles.radarPanel} aria-label="侧边信息">
      {/* 雷达卡片 */}
      <div className={styles.radarCard}>
        <h2 className={styles.radarTitle}>今日雷达</h2>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={styles.tabsList}>
            <TabsTrigger value="topics" className={styles.tabTrigger}>
              <Hash size={16} />
              话题
            </TabsTrigger>
            <TabsTrigger value="galaxies" className={styles.tabTrigger}>
              <Orbit size={16} />
              星系
            </TabsTrigger>
            <TabsTrigger value="announcements" className={styles.tabTrigger}>
              <Megaphone size={16} />
              公告
            </TabsTrigger>
          </TabsList>

          {/* 话题 Tab */}
          <TabsContent value="topics" className={styles.tabContent}>
            {topics.length > 0 ? (
              <div className={styles.topicList}>
                {topics.slice(0, 5).map((topic, index) => (
                  <Link
                    key={topic.id}
                    href={`/topics/${topic.slug}`}
                    className={styles.topicItem}
                  >
                    <span className={styles.topicRank}>#{index + 1}</span>
                    <div className={styles.topicInfo}>
                      <strong>{topic.name}</strong>
                      <small>{topic.contentCount ?? 0} 条讨论</small>
                    </div>
                    <TrendingUp className={styles.topicTrend} aria-label="热度上升" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.emptyHint}>暂无热门话题</p>
            )}
          </TabsContent>

          {/* 星系 Tab */}
          <TabsContent value="galaxies" className={styles.tabContent}>
            {galaxies.length > 0 ? (
              <div className={styles.galaxyList}>
                {galaxies.slice(0, 4).map((galaxy) => (
                  <Link
                    key={galaxy.id}
                    href={`/galaxies/${galaxy.slug}`}
                    className={styles.galaxyItem}
                  >
                    <Avatar src={galaxy.avatar} fallback={galaxy.name} size="md" />
                    <div className={styles.galaxyInfo}>
                      <strong>{galaxy.name}</strong>
                      <small>
                        {galaxy.memberCount != null
                          ? `${galaxy.memberCount} 位成员`
                          : "成员数量未公开"}
                      </small>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.emptyHint}>
                {isGuest ? "登录后查看你的星系" : "还没有加入星系"}
              </p>
            )}
          </TabsContent>

          {/* 公告 Tab */}
          <TabsContent value="announcements" className={styles.tabContent}>
            {announcements.length > 0 ? (
              <div className={styles.announcementList}>
                {announcements.slice(0, 3).map((item) => (
                  <Link
                    key={item.id}
                    href={`/announcements/${item.id}`}
                    className={styles.announcementItem}
                  >
                    <div className={styles.announcementIcon}>
                      <Megaphone size={16} />
                    </div>
                    <div className={styles.announcementContent}>
                      <strong>{item.title}</strong>
                      <time>{item.publishedAt ? formatDateTime(item.publishedAt) : "星语公告"}</time>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.emptyHint}>暂无新公告</p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* 快捷方式 */}
      {!isGuest && (
        <div className={styles.radarCard}>
          <h3 className={styles.shortcutsTitle}>我的快捷方式</h3>
          <div className={styles.shortcuts}>
            <Link href="/studio" className={styles.shortcutLink}>
              <PenLine size={18} />
              创作中心
            </Link>
            <Link href="/me/collections" className={styles.shortcutLink}>
              <Bookmark size={18} />
              收藏夹
            </Link>
            <Link href="/me/history" className={styles.shortcutLink}>
              <Clock3 size={18} />
              阅读历史
            </Link>
            <Link href="/studio/drafts" className={styles.shortcutLink}>
              <FileEdit size={18} />
              草稿箱
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}
