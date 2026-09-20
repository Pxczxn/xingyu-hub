# Article Editor (`/studio/articles/:articleId/edit`)

## Purpose

创作控制台 editor for title, summary, body with auto-save and publish settings.

## Layout

```
(no AppShell — focused editor chrome)
├── top bar: back link, save status, publish button
├── main column
│   ├── title input (large)
│   ├── summary textarea
│   └── body textarea (markdown/plain)
└── sidebar (publish settings)
    ├── visibility
    ├── category
    ├── topics (placeholder)
    └── schedule (placeholder)
```

## Auto-save

- Debounce 1.5s after last change
- States: 已保存 / 保存中… / 保存失败
- `PATCH /api/v1/me/studio/articles/:id`

## API

- `GET /api/v1/me/articles/:id` — load draft
- `PUT /api/v1/me/articles/:id/draft` — auto-save
- `POST /api/v1/me/articles/:id/submit` — submit for review

## Visual

- Cream background, white editor surface
- Accent gold save indicator and publish CTA
- Sidebar separated with `Separator`
