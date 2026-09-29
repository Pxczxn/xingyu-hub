# Home Page (`/`)

## Purpose

Answer: **社区里现在有什么值得看** — a community content feed, not a module-card
dashboard. Personal resume affordances (继续阅读) are secondary and only appear
for a signed-in session that actually has data.

## Layout (desktop)

```
AppShell
└── main (max-w-6xl)
    ├── PageHero
    └── grid lg:grid-cols-3
        ├── left  (lg:col-span-2)   ← feed column
        │   ├── HomeFeedTabs        推荐 / 关注
        │   ├── ContinueReadingStrip (signed-in + data only)
        │   └── feed rows (HomeFeedItem, vertical list)
        └── right (lg:col-span-1)   ← HomeSidebar
            ├── AnnouncementPanel   社区公告
            └── TrendingTopicsPanel 热门话题
```

The feed column spans all three columns when the rail has nothing to render.

## Feed tabs

| Tab | Source (member) | Source (guest) |
|---|---|---|
| 推荐 | `MeHomeView.recommendations` | `GuestHomeView.discoveries` |
| 关注 | `MeHomeView.followUpdates` | `GuestHomeView.followingUpdates` |

Both tabs read the **same** composition payload — there is no separate feed
endpoint and none is invented. Guest 关注 is normally empty; it renders a
"登录后可见关注动态" empty state rather than being hidden, so the tab set is stable.

**最新 is intentionally absent.** No chronological "latest content" endpoint
exists in this codebase: `/api/v1/discover` takes no sort parameter and
`/api/v1/search?sort=latest` requires a keyword. A third tab would be a control
that can never return data, so it is not rendered at all.

## Modules

| Module | Content | Empty behaviour |
|---|---|---|
| 继续阅读 | Resume rows (compact horizontal strip) | Signed-in only; hidden when absent |
| 社区公告 | Latest announcements | Hidden (non-critical) |
| 热门话题 | Topics ranked by `contentCount` | Hidden (non-critical) |

`SectionState` keeps its generic loading / error / empty behaviour everywhere.
The home-specific rule is that **non-critical modules are hidden when empty**
instead of showing a placeholder box, so an empty module never occupies a large
area of the page. Empty is decided in the module (`status === "empty"`), not
inside `SectionState`.

## API

| Endpoint | Used for |
|---|---|
| `GET /api/v1/home` | Guest composition (guest 推荐 / 关注) |
| `GET /api/v1/me/home` | Member composition (推荐 / 关注 / 继续阅读) |
| `GET /api/v1/announcements?limit=3` | 社区公告 |
| `GET /api/v1/topics` | 热门话题 |

A failing composition endpoint is fatal (`PageState kind="error"`). A failing
rail module degrades inside its own module only.

## Components

| Component | Responsibility |
|---|---|
| `HomeFeedTabs` | Feed switcher (推荐 / 关注) |
| `HomeFeedItem` | One feed row; shares `contentHref` with `ContentCard` |
| `ContinueReadingStrip` | Compact resume strip |
| `AnnouncementPanel` | 社区公告 module |
| `TrendingTopicsPanel` | 热门话题 module |
| `HomeSidebar` | Rail composition + "is the rail visible" rule |

`HomePage` owns data state and composition only.

`ContentCard` is unchanged and remains the grid primitive for
discover / search / topic. Home uses rows (`HomeFeedItem`) instead.

## Visual

- Cream page background
- White surfaces with subtle border
- Gold accent for the active feed tab, module links and primary CTAs
- All colours reference the semantic tokens in `src/styles/tokens.css`
