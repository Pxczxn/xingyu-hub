import type { LucideIcon } from "lucide-react";
import type { ContentSummary, GalaxySummary, SeriesSummary, TopicSummary, AnnouncementSummary } from "@/lib/community-api";

export type UserState = {
  draftCount: number;
  unreadCount: number;
  continueReading: ContentSummary[];
  onboardingCompleted: boolean;
};

export type SmartAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  variant: "primary" | "secondary" | "tertiary";
};

export type HomeV2Props = {
  isGuest: boolean;
  loading: boolean;
  profile: {
    username?: string;
    displayName?: string;
    avatar?: string;
    authenticated?: boolean;
  };
  userState: UserState;
  continueReading: ContentSummary[];
  followUpdates: ContentSummary[];
  recommendations: ContentSummary[];
  topics: TopicSummary[];
  announcements: AnnouncementSummary[];
  galaxies: GalaxySummary[];
  series: SeriesSummary[];
};
