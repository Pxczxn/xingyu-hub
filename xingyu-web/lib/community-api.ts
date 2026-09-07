import { ApiError, apiRequest, apiUpload, getStoredToken } from "@/lib/api-client";

export type PageResult<T> = { items: T[]; nextCursor?: string | null; total?: number };

export type PublicConfig = {
  registration: {
    enabled: boolean;
    verifyEmail: boolean;
    verifyPhone: boolean;
    needAudit: boolean;
    defaultRole: string;
    captchaEnabled: boolean;
  };
  password: {
    minLength: number;
    maxLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumber: boolean;
    requireSpecial: boolean;
  };
  storage: { maxSize: number; allowTypes: string };
  login: { rememberMe: boolean; captchaEnabled: boolean; captchaType: string; maxRetryCount: number };
  sms: { enabled: boolean };
  siteName: string;
};

export type ContentSummary = {
  id: string;
  title: string;
  summary?: string;
  authorName?: string;
  updatedAt?: string;
  readMinutes?: number;
  cover?: string;
  objectType?: string;
};

export type ArticleRevision = {
  id: string;
  revisionNumber: number;
  title?: string;
  summary?: string;
  visibility?: string;
  frozenAt?: string;
};

export type GuestHomeView = {
  unreadNotifications: number;
  continueReading: ContentSummary[];
  followingUpdates: ContentSummary[];
  discoveries: ContentSummary[];
};

export type TopicSummary = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  followerCount?: number;
  contentCount?: number;
  following?: boolean;
};

export type TopicCreatorSummary = {
  username: string;
  displayName?: string;
  contentCount: number;
};

export type NotificationSummary = {
  id: string;
  title: string;
  body?: string;
  category: string;
  read: boolean;
  createdAt: string;
  targetRoute?: string;
};

export type ProfileDetail = {
  username: string;
  displayName?: string | null;
  bio?: string | null;
  avatar?: string | null;
  websiteUrl?: string | null;
  visibility?: string;
  followersVisibility?: string;
  lockVersion?: number;
  followerCount?: number;
  followingCount?: number;
  owner?: boolean;
  following?: boolean;
};

export type ArticleDetail = {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  slug: string | null;
  visibility: string;
  spaceSlug: string;
  ownerUsername: string;
  publishedAt: string | null;
  owner: boolean;
};

export type ArticleSummary = {
  id: string;
  status: string;
  lifecycleStatus?: string;
  moderationStatus?: string;
  title: string;
  categoryId: string | null;
  updatedAt: string;
};

export type MomentDetail = {
  id: string;
  body?: string | null;
  authorId?: string;
  createdAt?: string;
};

export type CollectionDetail = {
  id: string;
  title?: string;
  description?: string | null;
  visibility?: string;
  items?: Array<{ id: string; title?: string; objectType?: string; objectId?: string }>;
};

export type CollectionSummary = {
  id: string;
  title: string;
  visibility: string;
  itemCount: number;
};

export type SeriesSummary = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  status: string;
  chapterCount?: number;
  updatedAt: string;
};

export type SeriesDetail = SeriesSummary & {
  description?: string | null;
  lockVersion?: number;
  chapters: Array<{ id: string; articleId: string; title?: string; position: number }>;
};

export type SpaceWorks = {
  username: string;
  spaceSlug: string;
  displayName?: string | null;
  description?: string | null;
  owner: boolean;
  categories: Array<{ id: string; name: string; slug: string }>;
  works: Array<{ id: string; title: string; categorySlug?: string | null }>;
  nextCursor?: string | null;
};

export type ConversationSummary = {
  id: string;
  type: "DIRECT" | "GROUP";
  title: string;
  lastMessage?: string;
  unreadCount?: number;
  updatedAt: string;
  announcement?: string | null;
  announcementUpdatedAt?: string | null;
  joinMode?: "OPEN" | "APPROVAL";
  myRole?: string | null;
};

export type ConversationDetail = ConversationSummary & {
  messages?: ChatMessage[];
};

export type GroupJoinRequest = {
  id: string;
  conversationId: string;
  userId: string;
  username: string;
  displayName?: string | null;
  message?: string | null;
  status: string;
  createdAt: string;
};

export type ClientSettings = {
  notifications?: Record<string, boolean>;
  preferences?: Record<string, boolean>;
  searchHistory?: string[];
  personalizedRecommendationEnabled?: boolean;
};

export type ApiToken = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  status: string;
  lastUsedAt?: string | null;
  createdAt?: string;
};

export type ApiTokenCreated = ApiToken & { token: string };

export type ChatMessage = {
  id: string;
  conversationId?: string;
  conversationType?: "DIRECT" | "GROUP";
  sequence?: number;
  senderType?: string;
  senderId?: string;
  body: string;
  messageType?: "TEXT" | "IMAGE" | "FILE";
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  status?: string;
  createdAt: string;
};

export type SavedMessage = {
  id: string;
  messageId: string;
  conversationId: string;
  conversationType: "DIRECT" | "GROUP";
  conversationTitle?: string | null;
  messageType: string;
  body: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  senderId: string;
  messageCreatedAt: string;
  savedAt: string;
};

export type MyGroupJoinRequest = {
  id: string;
  conversationId: string;
  conversationTitle?: string | null;
  joinMode?: string;
  message?: string | null;
  status: string;
  createdAt: string;
  resolvedAt?: string | null;
};

export type MessageUploadResult = {
  url: string;
  name: string;
  mimeType: string;
};

export type CommentItem = {
  id: string;
  authorId: string;
  authorUsername?: string;
  body: string;
  createdAt: string;
  parentId?: string | null;
};

export type ModerationCase = {
  id: string;
  status: string;
  targetType: string;
  targetId: string;
  updatedAt: string;
};

export type ReportDetail = ModerationCase & {
  reason: string;
  detail?: string | null;
  createdAt: string;
  caseId?: string | null;
  caseStatus?: string | null;
  measureId?: string | null;
};

export type FollowUser = {
  userId: string;
  username: string;
  displayName?: string | null;
  followedAt?: string;
};

export type MyComment = {
  id: string;
  body: string;
  objectType: string;
  objectId: string;
  objectTitle?: string;
  createdAt: string;
};

export type MyLike = {
  objectType: string;
  objectId: string;
  title?: string;
  createdAt: string;
};

export type CommentDetail = CommentItem & {
  objectType: string;
  objectId: string;
};

export type AnnouncementSummary = {
  id: string;
  title: string;
  body?: string;
  publishedAt?: string;
};

export type GalaxySummary = {
  id: string;
  slug: string;
  name: string;
  official: boolean;
  memberCount?: number;
};

export type GalaxyMember = {
  userId: string;
  username: string;
  displayName?: string | null;
  role: string;
  joinedAt?: string;
};

export type GalaxyContentItem = {
  id: string;
  objectType: string;
  objectId: string;
  title?: string;
  pinned: boolean;
};

export type EventSummary = {
  id: string;
  slug: string;
  title: string;
  body?: string;
  startsAt?: string;
  endsAt?: string;
  submissionOpen: boolean;
};

export type EventSubmission = {
  id: string;
  eventId: string;
  objectType: string;
  objectId: string;
  objectTitle?: string | null;
  note?: string;
  status: string;
  createdAt: string;
};

export type GuidePageSummary = {
  id: string;
  slug: string;
  title: string;
  body?: string;
  publishedAt?: string;
};

export type AppealDetail = {
  id: string;
  caseId: string;
  body: string;
  status: string;
  createdAt: string;
};

export type ReviewSubmissionDetail = {
  id: string;
  articleId: string;
  title?: string | null;
  status: string;
  submittedAt: string;
  decision?: string | null;
  decisionComment?: string | null;
};

export type ConversationMember = {
  userId: string;
  username: string;
  displayName?: string | null;
  role: string;
};

export type SearchHit = {
  objectType: string;
  objectId: string;
  title: string;
  summary?: string;
};

export type OnboardingState = {
  step: string;
  interestsJson: string | null;
  completed: boolean;
};

export type AccountStatus = {
  status: string;
  canChangeEmail: boolean;
  canChangePassword: boolean;
  requiresReAuth: boolean;
  allowedActions: string[];
};

export type MeAccount = {
  email: string;
  emailVerified: boolean;
  username?: string;
};

export type TrashItem = {
  objectType: string;
  objectId: string;
  title?: string | null;
  trashedAt: string;
};

export type CreationCategory = {
  id: string;
  name: string;
  slug: string;
  status?: string;
  lockVersion?: number;
  sortOrder: number;
};

export type CursorInput = { cursor?: string; limit?: number };

export type SessionView = {
  sessionId: string;
  deviceLabel: string;
  lastActiveAt: string;
  expiresAt: string;
  revoked: boolean;
  current: boolean;
};

export type RecommendationFeedback = {
  id: string;
  body: string;
  createdAt: string;
};

export type BadgeView = {
  id: string;
  title: string;
  description: string;
  earned: boolean;
};

export type InsightsView = {
  articleCount: number;
  draftCount: number;
  followerCount: number;
  followingCount: number;
  commentCount: number;
  likeCount: number;
};

export type PendingAction = {
  type: string;
  title: string;
  href: string;
};

export type MeHomeView = {
  continueReading: ContentSummary[];
  followUpdates: ContentSummary[];
  recommendations: ContentSummary[];
  draftArticles: ContentSummary[];
  pendingActions: PendingAction[];
};

export type ArticleDraft = {
  articleId: string;
  title: string;
  summary: string;
  body: string;
  visibility: string;
  categoryId: string | null;
  topicIds: string[];
  lockVersion: number;
  updatedAt: string;
  scheduledPublishAt: string | null;
};

export type CollaborationInvite = {
  id: string;
  token: string;
  inviteUrl: string;
  note: string | null;
  expiresAt: string;
};

export type CollaborationInviteResolve = {
  valid: boolean;
  inviterUsername?: string;
  inviterDisplayName?: string | null;
  note?: string;
  expiresAt?: string;
};

export type MessageSearchHit = ChatMessage;

export type MutationResult = { id: string; status: string };

const query = (input: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const value = params.toString();
  return value ? `?${value}` : "";
};

function toContentSummary(hit: SearchHit): ContentSummary {
  return {
    id: hit.objectId,
    objectType: hit.objectType,
    title: hit.title,
    summary: hit.summary,
  };
}

function mapGuestHome(raw: {
  unreadNotifications: number;
  continueReading: SearchHit[];
  followingUpdates: SearchHit[];
  discoveries: SearchHit[];
}): GuestHomeView {
  return {
    unreadNotifications: raw.unreadNotifications,
    continueReading: raw.continueReading.map(toContentSummary),
    followingUpdates: raw.followingUpdates.map(toContentSummary),
    discoveries: raw.discoveries.map(toContentSummary),
  };
}

function toPage<T>(items: T[], total?: number): PageResult<T> {
  return { items, nextCursor: null, total: total ?? items.length };
}

/** 社区 API 统一入口，路径与后端 xingyu-community-api 对齐。 */
export const communityApi = {
  // 首页与发现
  getGuestHome: async () => {
    const raw = await apiRequest<{
      unreadNotifications: number;
      continueReading: SearchHit[];
      followingUpdates: SearchHit[];
      discoveries: SearchHit[];
    }>("/api/v1/home");
    return mapGuestHome(raw);
  },

  getHome: () => apiRequest<MeHomeView>("/api/v1/me/home"),

  getDiscover: (input: CursorInput = {}) =>
    apiRequest<PageResult<ContentSummary>>(`/api/v1/discover${query(input)}`),

  search: async (q: string, type?: string, limit = 20): Promise<PageResult<ContentSummary>> => {
    const hits = await apiRequest<SearchHit[]>(
      `/api/v1/search${query({ q, type, limit })}`
    );
    return toPage(hits.map(toContentSummary), hits.length);
  },

  // 话题
  getTopics: (keyword?: string) =>
    apiRequest<TopicSummary[]>(`/api/v1/topics${keyword ? query({ keyword }) : ""}`),

  getTopic: (slug: string) => apiRequest<TopicSummary>(`/api/v1/topics/${encodeURIComponent(slug)}`),

  getTopicContent: (slug: string, sort: "latest" | "hot" = "latest", limit = 12) =>
    apiRequest<ContentSummary[]>(
      `/api/v1/topics/${encodeURIComponent(slug)}/content${query({ sort, limit })}`
    ),

  getTopicCreators: (slug: string, limit = 12) =>
    apiRequest<TopicCreatorSummary[]>(
      `/api/v1/topics/${encodeURIComponent(slug)}/creators${query({ limit })}`
    ),

  followTopic: (topicId: string) =>
    apiRequest<void>(`/api/v1/follows/topics/${encodeURIComponent(topicId)}`, { method: "POST" }),

  unfollowTopic: (topicId: string) =>
    apiRequest<void>(`/api/v1/follows/topics/${encodeURIComponent(topicId)}`, { method: "DELETE" }),

  // 星系与公告
  getGalaxies: () => apiRequest<GalaxySummary[]>("/api/v1/galaxies"),

  getGalaxy: (slug: string) =>
    apiRequest<GalaxySummary>(`/api/v1/galaxies/${encodeURIComponent(slug)}`),

  getGalaxyMembers: (slug: string, limit = 50) =>
    apiRequest<GalaxyMember[]>(`/api/v1/galaxies/${encodeURIComponent(slug)}/members${query({ limit })}`),

  getGalaxyContent: (slug: string, limit = 20) =>
    apiRequest<GalaxyContentItem[]>(`/api/v1/galaxies/${encodeURIComponent(slug)}/content${query({ limit })}`),

  joinGalaxy: (slug: string) =>
    apiRequest<GalaxySummary>(`/api/v1/galaxies/${encodeURIComponent(slug)}/join`, { method: "POST" }),

  getMyGalaxies: () => apiRequest<GalaxySummary[]>("/api/v1/me/galaxies"),

  getEvents: (limit = 20) =>
    apiRequest<EventSummary[]>(`/api/v1/events${query({ limit })}`),

  getEvent: (eventId: string) =>
    apiRequest<EventSummary>(`/api/v1/events/${encodeURIComponent(eventId)}`),

  getEventSubmissions: (eventId: string, limit = 50) =>
    apiRequest<EventSubmission[]>(`/api/v1/events/${encodeURIComponent(eventId)}/submissions${query({ limit })}`),

  submitToEvent: (eventId: string, payload: { objectType: string; objectId: string; note?: string }) =>
    apiRequest<EventSubmission>(`/api/v1/me/events/${encodeURIComponent(eventId)}/submissions`, {
      method: "POST",
      body: payload,
    }),

  getMyEventSubmissions: (limit = 20) =>
    apiRequest<EventSubmission[]>(`/api/v1/me/event-submissions${query({ limit })}`),

  getGuidePages: (limit = 50) =>
    apiRequest<GuidePageSummary[]>(`/api/v1/guide${query({ limit })}`),

  getGuidePage: (slug: string) =>
    apiRequest<GuidePageSummary>(`/api/v1/guide/${encodeURIComponent(slug)}`),

  getAnnouncements: (limit = 20) =>
    apiRequest<AnnouncementSummary[]>(`/api/v1/announcements${query({ limit })}`),

  getAnnouncement: (id: string) =>
    apiRequest<AnnouncementSummary>(`/api/v1/announcements/${encodeURIComponent(id)}`),

  // 文章
  getArticle: (articleId: string) =>
    apiRequest<ArticleDetail>(`/api/v1/articles/${encodeURIComponent(articleId)}`),

  listMyArticles: () => apiRequest<ArticleSummary[]>("/api/v1/me/articles"),

  createArticle: () => apiRequest<{ articleId: string }>("/api/v1/me/articles", { method: "POST" }),

  getArticleDraft: (articleId: string) =>
    apiRequest<ArticleDraft>(`/api/v1/me/articles/${encodeURIComponent(articleId)}`),

  getArticleRevisions: (articleId: string) =>
    apiRequest<ArticleRevision[]>(`/api/v1/me/articles/${encodeURIComponent(articleId)}/revisions`),

  saveArticleDraft: (
    articleId: string,
    payload: {
      title: string;
      body: string;
      summary?: string;
      visibility?: string;
      categoryId?: string | null;
      topicIds?: string[];
      scheduledPublishAt?: string | null;
      lockVersion?: number;
      version?: number;
    }
  ) =>
    apiRequest<ArticleDraft>(`/api/v1/me/articles/${encodeURIComponent(articleId)}/draft`, {
      method: "PUT",
      body: payload,
    }),

  restoreArticleRevision: (articleId: string, revisionId: string) =>
    apiRequest<ArticleDraft>(
      `/api/v1/me/articles/${encodeURIComponent(articleId)}/revisions/${encodeURIComponent(revisionId)}/restore`,
      { method: "POST" }
    ),

  submitArticle: (articleId: string) =>
    apiRequest<{ submissionId: string }>(`/api/v1/me/articles/${encodeURIComponent(articleId)}/submit`, {
      method: "POST",
    }),

  trashArticle: (articleId: string) =>
    apiRequest<TrashItem>(`/api/v1/me/articles/${encodeURIComponent(articleId)}/trash`, {
      method: "POST",
    }),

  restoreArticle: (articleId: string) =>
    apiRequest<void>(`/api/v1/me/articles/${encodeURIComponent(articleId)}/restore`, {
      method: "POST",
    }),

  listMyTrash: () => apiRequest<TrashItem[]>("/api/v1/me/trash"),

  // 系列
  listSeries: (limit = 20) =>
    apiRequest<SeriesSummary[]>(`/api/v1/series${query({ limit })}`),

  listMySeries: () => apiRequest<SeriesSummary[]>("/api/v1/me/series"),

  getMySeries: (seriesId: string) =>
    apiRequest<SeriesDetail>(`/api/v1/me/series/${encodeURIComponent(seriesId)}`),

  createSeries: (payload: { title: string; slug?: string; description?: string }) =>
    apiRequest<SeriesDetail>("/api/v1/me/series", { method: "POST", body: payload }),

  updateSeries: (seriesId: string, payload: Record<string, unknown>) =>
    apiRequest<SeriesDetail>(`/api/v1/me/series/${encodeURIComponent(seriesId)}`, {
      method: "PUT",
      body: payload,
    }),

  getSeries: (seriesId: string) =>
    apiRequest<SeriesDetail>(`/api/v1/series/${encodeURIComponent(seriesId)}`),

  // 动态
  getMoments: (limit = 20) =>
    apiRequest<MomentDetail[]>(`/api/v1/moments${query({ limit })}`),

  getMoment: (momentId: string) =>
    apiRequest<MomentDetail>(`/api/v1/moments/${encodeURIComponent(momentId)}`),

  publishMoment: (body: string) =>
    apiRequest<MomentDetail>("/api/v1/moments", { method: "POST", body: { body } }),

  // 收藏
  getCollections: () => apiRequest<CollectionSummary[]>("/api/v1/me/collections"),

  createCollection: (payload: { title: string; visibility?: string }) =>
    apiRequest<CollectionSummary>("/api/v1/me/collections", { method: "POST", body: payload }),

  getCollection: (collectionId: string) =>
    apiRequest<CollectionDetail>(`/api/v1/collections/${encodeURIComponent(collectionId)}`),

  addCollectionItem: (collectionId: string, objectType: string, objectId: string) =>
    apiRequest<{ id: string; title?: string; objectType: string; objectId: string }>(
      `/api/v1/me/collections/${encodeURIComponent(collectionId)}/items`,
      { method: "POST", body: { objectType, objectId } }
    ),

  addBookmark: (objectType: string, objectId: string) =>
    apiRequest<void>("/api/v1/me/bookmarks", {
      method: "POST",
      body: { objectType, objectId },
    }),

  removeBookmark: (objectType: string, objectId: string) =>
    apiRequest<void>("/api/v1/me/bookmarks", {
      method: "DELETE",
      body: { objectType, objectId },
    }),

  getBookmarkStatus: (objectType: string, objectId: string) =>
    apiRequest<{ bookmarked: boolean }>(
      `/api/v1/bookmarks/status${query({ objectType, objectId })}`
    ),

  updateCollection: (collectionId: string, payload: { title?: string; visibility?: string }) =>
    apiRequest<CollectionSummary>(`/api/v1/me/collections/${encodeURIComponent(collectionId)}`, {
      method: "PATCH",
      body: payload,
    }),

  deleteCollection: (collectionId: string) =>
    apiRequest<void>(`/api/v1/me/collections/${encodeURIComponent(collectionId)}`, { method: "DELETE" }),

  removeCollectionItem: (collectionId: string, itemId: string) =>
    apiRequest<void>(
      `/api/v1/me/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`,
      { method: "DELETE" }
    ),

  getBookshelf: (input: CursorInput = {}) =>
    apiRequest<PageResult<ContentSummary>>(`/api/v1/me/bookshelf${query(input)}`),

  getHistory: (input: CursorInput = {}) =>
    apiRequest<PageResult<ContentSummary>>(`/api/v1/me/reading-history${query(input)}`),

  recordReadingProgress: (seriesId: string, articleId: string) =>
    apiRequest<void>("/api/v1/me/reading-progress", {
      method: "POST",
      body: { seriesId, articleId },
    }),

  // 用户与空间
  getProfile: (username: string) =>
    apiRequest<ProfileDetail>(`/api/v1/users/${encodeURIComponent(username)}`),

  getSuggestedUsers: (limit = 10) =>
    apiRequest<FollowUser[]>(`/api/v1/users/suggested${query({ limit })}`),

  getMyProfile: () => {
    if (!getStoredToken()) {
      return Promise.reject(
        new ApiError({
          type: "about:blank",
          title: "Unauthorized",
          status: 401,
          detail: "当前未登录",
          code: "UNAUTHORIZED",
        })
      );
    }
    return apiRequest<ProfileDetail>("/api/v1/me/profile");
  },

  tryGetMyProfile: async (): Promise<ProfileDetail | null> => {
    if (!getStoredToken()) return null;
    try {
      return await apiRequest<ProfileDetail>("/api/v1/me/profile");
    } catch (err) {
      if (err instanceof ApiError && err.problem.status === 401) return null;
      throw err;
    }
  },

  updateMyProfile: (payload: Record<string, unknown>) =>
    apiRequest<ProfileDetail>("/api/v1/me/profile", { method: "PATCH", body: payload }),

  updatePrivacy: (payload: { followersVisibility?: string }) =>
    apiRequest<ProfileDetail>("/api/v1/me/profile/privacy", { method: "PATCH", body: payload }),

  getUserWorks: (username: string, category?: string) =>
    apiRequest<SpaceWorks>(
      `/api/v1/users/${encodeURIComponent(username)}/works${category ? query({ category }) : ""}`
    ),

  getSpaceWorks: (spaceSlug: string, category?: string) =>
    apiRequest<SpaceWorks>(
      `/api/v1/spaces/${encodeURIComponent(spaceSlug)}/works${category ? query({ category }) : ""}`
    ),

  followUser: (username: string) =>
    apiRequest<void>(`/api/v1/users/${encodeURIComponent(username)}/follow`, { method: "POST" }),

  unfollowUser: (username: string) =>
    apiRequest<void>(`/api/v1/users/${encodeURIComponent(username)}/follow`, { method: "DELETE" }),

  // 互动
  like: (objectType: string, objectId: string) =>
    apiRequest<void>(`/api/v1/likes/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`, {
      method: "POST",
    }),

  unlike: (objectType: string, objectId: string) =>
    apiRequest<void>(`/api/v1/likes/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`, {
      method: "DELETE",
    }),

  getLikeCount: (objectType: string, objectId: string) =>
    apiRequest<{ count: number }>(
      `/api/v1/likes/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}/count`
    ),

  getLikeStatus: (objectType: string, objectId: string) =>
    apiRequest<{ liked: boolean }>(
      `/api/v1/likes/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}/status`
    ),

  getComments: (objectType: string, objectId: string) =>
    apiRequest<CommentItem[]>(
      `/api/v1/comments/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`
    ),

  createComment: (payload: { objectType: string; objectId: string; body: string; parentId?: string }) =>
    apiRequest<CommentItem>("/api/v1/comments", { method: "POST", body: payload }),

  getComment: (commentId: string) =>
    apiRequest<CommentDetail>(`/api/v1/comments/lookup/${encodeURIComponent(commentId)}`),

  // 消息
  getConversations: () => apiRequest<ConversationSummary[]>("/api/v1/messages"),

  getDirectConversation: (conversationId: string) =>
    apiRequest<ConversationDetail>(`/api/v1/messages/direct/${encodeURIComponent(conversationId)}`),

  sendDirectMessage: (conversationId: string, body: string) =>
    apiRequest<ChatMessage>(`/api/v1/messages/direct/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      body: { body },
    }),

  createGroupConversation: (title: string) =>
    apiRequest<ConversationDetail>("/api/v1/messages/group", { method: "POST", body: { title } }),

  getGroupConversation: (conversationId: string) =>
    apiRequest<ConversationDetail>(`/api/v1/messages/group/${encodeURIComponent(conversationId)}`),

  sendGroupMessage: (conversationId: string, body: string) =>
    apiRequest<ChatMessage>(`/api/v1/messages/group/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      body: { body },
    }),

  getGroupMembers: (conversationId: string) =>
    apiRequest<ConversationMember[]>(`/api/v1/messages/group/${encodeURIComponent(conversationId)}/members`),

  updateGroupAnnouncement: (conversationId: string, announcement: string) =>
    apiRequest<ConversationDetail>(
      `/api/v1/messages/group/${encodeURIComponent(conversationId)}/announcement`,
      { method: "PATCH", body: { announcement } }
    ),

  updateGroupSettings: (
    conversationId: string,
    payload: { title?: string; joinMode?: "OPEN" | "APPROVAL" }
  ) =>
    apiRequest<ConversationDetail>(
      `/api/v1/messages/group/${encodeURIComponent(conversationId)}/settings`,
      { method: "PATCH", body: payload }
    ),

  getGroupJoinRequests: (conversationId: string) =>
    apiRequest<GroupJoinRequest[]>(
      `/api/v1/messages/group/${encodeURIComponent(conversationId)}/join-requests`
    ),

  submitGroupJoinRequest: (conversationId: string, message?: string) =>
    apiRequest<GroupJoinRequest>(
      `/api/v1/messages/group/${encodeURIComponent(conversationId)}/join-requests`,
      { method: "POST", body: { message } }
    ),

  approveGroupJoinRequest: (conversationId: string, requestId: string) =>
    apiRequest<void>(
      `/api/v1/messages/group/${encodeURIComponent(conversationId)}/join-requests/${encodeURIComponent(requestId)}/approve`,
      { method: "POST" }
    ),

  rejectGroupJoinRequest: (conversationId: string, requestId: string) =>
    apiRequest<void>(
      `/api/v1/messages/group/${encodeURIComponent(conversationId)}/join-requests/${encodeURIComponent(requestId)}/reject`,
      { method: "POST" }
    ),

  getConversationMedia: (conversationId: string, limit = 50) =>
    apiRequest<ChatMessage[]>(
      `/api/v1/messages/${encodeURIComponent(conversationId)}/media${query({ limit })}`
    ),

  getConversationFiles: (conversationId: string, limit = 50) =>
    apiRequest<ChatMessage[]>(
      `/api/v1/messages/${encodeURIComponent(conversationId)}/files${query({ limit })}`
    ),

  uploadMessageAttachment: (file: File) =>
    apiUpload<MessageUploadResult>("/api/v1/messages/upload", file),

  sendDirectMessagePayload: (conversationId: string, payload: Record<string, string>) =>
    apiRequest<ChatMessage>(`/api/v1/messages/direct/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      body: payload,
    }),

  sendGroupMessagePayload: (conversationId: string, payload: Record<string, string>) =>
    apiRequest<ChatMessage>(`/api/v1/messages/group/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      body: payload,
    }),

  getSavedMessages: (limit = 50) =>
    apiRequest<SavedMessage[]>(`/api/v1/me/saved-messages${query({ limit })}`),

  saveMessage: (messageId: string) =>
    apiRequest<SavedMessage>("/api/v1/me/saved-messages", { method: "POST", body: { messageId } }),

  removeSavedMessage: (messageId: string) =>
    apiRequest<void>(`/api/v1/me/saved-messages/${encodeURIComponent(messageId)}`, { method: "DELETE" }),

  getMyGroupJoinRequests: (limit = 20) =>
    apiRequest<MyGroupJoinRequest[]>(`/api/v1/me/group-join-requests${query({ limit })}`),

  searchMessages: (q: string, limit = 50) =>
    apiRequest<MessageSearchHit[]>(`/api/v1/messages/search${query({ q, limit })}`),

  leaveGroup: (conversationId: string) =>
    apiRequest<void>(`/api/v1/messages/group/${encodeURIComponent(conversationId)}/leave`, {
      method: "POST",
    }),

  removeGroupMember: (conversationId: string, userId: string) =>
    apiRequest<void>(
      `/api/v1/messages/group/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE" }
    ),

  getClientSettings: () => apiRequest<ClientSettings>("/api/v1/me/client-settings"),

  updateClientSettings: (payload: ClientSettings) =>
    apiRequest<ClientSettings>("/api/v1/me/client-settings", { method: "PUT", body: payload }),

  listApiTokens: (limit = 20) =>
    apiRequest<ApiToken[]>(`/api/v1/me/api-tokens${query({ limit })}`),

  createApiToken: (payload: { name: string; scopes?: string[] }) =>
    apiRequest<ApiTokenCreated>("/api/v1/me/api-tokens", { method: "POST", body: payload }),

  revokeApiToken: (tokenId: string) =>
    apiRequest<void>(`/api/v1/me/api-tokens/${encodeURIComponent(tokenId)}`, { method: "DELETE" }),

  openDirectConversation: (otherUserId: string) =>
    apiRequest<ConversationDetail>(`/api/v1/messages/direct/${encodeURIComponent(otherUserId)}`, {
      method: "POST",
    }),

  // 通知
  getNotifications: () => apiRequest<NotificationSummary[]>("/api/v1/notifications"),

  markNotificationRead: (notificationId: string) =>
    apiRequest<NotificationSummary>(
      `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`,
      { method: "PATCH" }
    ),

  markAllNotificationsRead: () =>
    apiRequest<void>("/api/v1/notifications/read-all", { method: "POST" }),

  // 账户
  getMe: () => apiRequest<MeAccount>("/api/v1/me"),

  getOnboarding: () => apiRequest<OnboardingState>("/api/v1/me/onboarding"),

  updateOnboarding: (payload: Record<string, unknown>) =>
    apiRequest<OnboardingState>("/api/v1/me/onboarding", { method: "PATCH", body: payload }),

  getAccountStatus: () => apiRequest<AccountStatus>("/api/v1/me/account-status"),

  // 治理
  createReport: (payload: { targetType: string; targetId: string; reason: string; detail?: string }) =>
    apiRequest<MutationResult>("/api/v1/reports", { method: "POST", body: payload }),

  getMyReports: () => apiRequest<ModerationCase[]>("/api/v1/me/reports"),

  getMyReport: (reportId: string) =>
    apiRequest<ReportDetail>(`/api/v1/me/reports/${encodeURIComponent(reportId)}`),

  getMyFollowing: (limit = 20) =>
    apiRequest<PageResult<FollowUser>>(`/api/v1/me/following${query({ limit })}`),

  getMyFollowers: (limit = 20) =>
    apiRequest<PageResult<FollowUser>>(`/api/v1/me/followers${query({ limit })}`),

  getMyComments: (limit = 20) =>
    apiRequest<MyComment[]>(`/api/v1/me/comments${query({ limit })}`),

  getMyLikes: (limit = 20) =>
    apiRequest<MyLike[]>(`/api/v1/me/likes${query({ limit })}`),

  getMyMoments: (limit = 20) =>
    apiRequest<MomentDetail[]>(`/api/v1/me/moments${query({ limit })}`),

  getMyAppeals: (limit = 20) =>
    apiRequest<AppealDetail[]>(`/api/v1/me/appeals${query({ limit })}`),

  getMyAppeal: (appealId: string) =>
    apiRequest<AppealDetail>(`/api/v1/me/appeals/${encodeURIComponent(appealId)}`),

  getMyReviewSubmissions: (limit = 20) =>
    apiRequest<ReviewSubmissionDetail[]>(`/api/v1/me/submissions${query({ limit })}`),

  getMyReviewSubmission: (submissionId: string) =>
    apiRequest<ReviewSubmissionDetail>(`/api/v1/me/submissions/${encodeURIComponent(submissionId)}`),

  withdrawReviewSubmission: (submissionId: string) =>
    apiRequest<{ id: string; status: string }>(`/api/v1/me/submissions/${encodeURIComponent(submissionId)}/withdraw`, {
      method: "POST",
    }),

  createAppeal: (payload: { measureId?: string; caseId?: string; detail: string }) =>
    apiRequest<MutationResult>("/api/v1/appeals", { method: "POST", body: payload }),

  // 认证
  getPublicConfig: () => apiRequest<PublicConfig>("/api/v1/public/config"),

  getCaptcha: () => apiRequest<{ uuid: string; img: string }>("/api/v1/auth/captcha"),

  sendRegisterSms: (phone: string) =>
    apiRequest<{ acknowledged: boolean; smsPending?: boolean }>("/api/v1/auth/sms/register", {
      method: "POST",
      body: { phone },
    }),

  login: (payload: { login: string; password: string; rememberMe?: boolean; uuid?: string; code?: string }) =>
    apiRequest<void>("/api/v1/auth/login", { method: "POST", body: payload }),

  register: (payload: Record<string, unknown>, idempotencyKey?: string) =>
    apiRequest<{
      userId: string;
      emailVerification: { status: string; canResend: boolean };
      mailPending?: boolean;
      auditStatus?: string | null;
    }>("/api/v1/auth/register", {
      method: "POST",
      body: payload,
      idempotencyKey,
    }),

  logout: () => apiRequest<void>("/api/v1/auth/logout", { method: "POST" }),

  reAuthenticate: (password: string) =>
    apiRequest<{ recentAuthId: string; expiresAt?: string }>("/api/v1/auth/re-authenticate", {
      method: "POST",
      body: { password },
    }),

  verifyEmail: (token: string) =>
    apiRequest<{ status: string }>("/api/v1/auth/email/verify", { method: "POST", body: { token } }),

  resendEmailVerification: (email?: string) =>
    apiRequest<{ acknowledged: boolean; mailPending: boolean }>("/api/v1/auth/email/resend", {
      method: "POST",
      body: email ? { email } : undefined,
    }),

  requestPasswordRecovery: (login: string) =>
    apiRequest<{ acknowledged: boolean; mailPending?: boolean; devResetLink?: string }>(
      "/api/v1/auth/password-recovery",
      {
        method: "POST",
        body: { login },
      }
    ),

  resetPassword: (payload: Record<string, string>) =>
    apiRequest<void>("/api/v1/auth/password-reset", { method: "POST", body: payload }),

  changeEmail: (payload: { newEmail: string; password: string }, recentAuthId?: string) =>
    apiRequest<{ currentEmail: string; pendingEmail: string; mailPending: boolean }>(
      "/api/v1/me/email/change",
      {
        method: "POST",
        body: payload,
        headers: recentAuthId ? { "X-Recent-Auth": recentAuthId } : undefined,
      }
    ),

  listSessions: () => apiRequest<SessionView[]>("/api/v1/me/sessions"),

  revokeSession: (sessionId: string) =>
    apiRequest<void>(`/api/v1/me/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),

  revokeOtherSessions: () =>
    apiRequest<void>("/api/v1/me/sessions/revoke-others", { method: "POST" }),

  // 创作空间分类
  listCategories: () => apiRequest<CreationCategory[]>("/api/v1/me/creation-space/categories"),

  createCategory: (payload: { name: string; slug?: string }) =>
    apiRequest<CreationCategory>("/api/v1/me/creation-space/categories", {
      method: "POST",
      body: payload,
    }),

  updateCategory: (categoryId: string, payload: Record<string, unknown>) =>
    apiRequest<CreationCategory>(
      `/api/v1/me/creation-space/categories/${encodeURIComponent(categoryId)}`,
      { method: "PATCH", body: payload }
    ),

  deleteCategory: (categoryId: string) =>
    apiRequest<void>(`/api/v1/me/creation-space/categories/${encodeURIComponent(categoryId)}`, {
      method: "DELETE",
    }),

  getRecommendationFeedback: (limit = 20) =>
    apiRequest<RecommendationFeedback[]>(`/api/v1/me/recommendation-feedback${query({ limit })}`),

  submitRecommendationFeedback: (body: string) =>
    apiRequest<RecommendationFeedback>("/api/v1/me/recommendation-feedback", {
      method: "POST",
      body: { body },
    }),

  getMyBadges: () => apiRequest<BadgeView[]>("/api/v1/me/badges"),

  getMyInsights: () => apiRequest<InsightsView>("/api/v1/me/insights"),

  getDataExport: () => apiRequest<Record<string, unknown>>("/api/v1/me/data-export"),

  requestAccountDeletion: () =>
    apiRequest<void>("/api/v1/me/account/deletion-request", { method: "POST" }),

  createCollaborationInvite: (note?: string) =>
    apiRequest<CollaborationInvite>("/api/v1/me/collaboration-invites", {
      method: "POST",
      body: { note },
    }),

  resolveCollaborationInvite: (token: string) =>
    apiRequest<CollaborationInviteResolve>(
      `/api/v1/collaboration/invites/resolve${query({ token })}`
    ),

  acceptCollaborationInvite: (token: string) =>
    apiRequest<{ accepted: boolean; inviterUsername?: string; inviterDisplayName?: string | null; note?: string }>(
      "/api/v1/collaboration/invites/accept",
      { method: "POST", body: { token } }
    ),
};

export function contentHref(item: Pick<ContentSummary, "id" | "objectType">): string {
  if (item.objectType === "SERIES") return `/series/${item.id}`;
  if (item.objectType === "MOMENT") return `/moments/${item.id}`;
  return `/articles/${item.id}`;
}
