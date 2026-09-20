# Home Page (`/`)

## Purpose

Answer: **我现在最值得做什么** — resume reading, continue writing, see follow updates.

## Layout

```
AppShell
└── main (max-w-6xl)
    ├── greeting + quick actions
    ├── 需要处理 (hidden when empty)
    ├── 继续创作
    ├── 继续阅读
    └── 关注更新
```

## Modules (logged-in)

| Module | Content | Empty state |
|---|---|---|
| 需要处理 | Review returns, publish failures | Hide module |
| 继续创作 | Recent drafts with edit time | Link to `/studio` |
| 继续阅读 | Articles/series with progress | Link to `/discover` |
| 关注更新 | Followed creators, topics, series | "去发现" CTA |

## Modules (guest)

- Hero: product tagline
- 编辑精选 placeholder cards
- Links to `/discover`, `/register`, `/login`

## API

- `GET /api/v1/me/home` — home composition (optional; placeholders when unavailable)

## Visual

- Cream page background
- White cards with subtle border
- Accent gold for primary CTAs and unread indicators
