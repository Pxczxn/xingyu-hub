# Creation Space (`/spaces/:spaceSlug`)

## Purpose

Public-facing container for a creator's published works. Canonical route per product spec.

## Layout

```
AppShell
└── main (max-w-4xl)
    ├── header: display name, @owner, description
    ├── category tabs (全部 + categories)
    ├── works list (title, category badge)
    └── owner actions: 管理分类, 编辑资料
```

## API

- `GET /api/v1/spaces/:spaceSlug/works?category=` — space profile + paginated works

Fallback: legacy `/api/v1/users/:username/works` during migration.

## Redirect

`/users/:username/works` → `/spaces/:spaceSlug` (301-style client redirect after slug lookup).

## Visual

- Navy headings on cream background
- Category pills: navy active, outline inactive
- Work rows as bordered cards with hover state
