> **设计基线 / 视觉参考（Legacy Web）**
> 本文档记录 Legacy Web（`xingyu-web`）中已通过代码验证的设计基线，同时作为后续 Web 重构的视觉参考。
> 它是「设计基线 / 视觉参考」，不是「旧路由架构必须照搬」——后续重构可沿用品牌色与基础 UI 原则，但不必复制 Legacy 的路由 / 目录结构。

# Xingyu Community Design System

## Brand palette

| Token | Hex | Usage |
|---|---|---|
| Navy | `#1A2138` | Primary text, navigation, headings, primary buttons |
| Cream | `#F9F7F2` | Page background, shell canvas |
| Accent Gold | `#F59E0B` | CTAs, active nav, highlights, save/publish accents |

## Typography

- **Font stack**: system UI (`ui-sans-serif`, `system-ui`, `-apple-system`, `Segoe UI`, sans-serif)
- **Headings**: semibold, navy
- **Body**: regular, navy at 90% opacity or muted foreground
- **Meta / captions**: `text-sm`, muted foreground

## Spacing & layout

- **Max content width**: `max-w-6xl` for main community pages
- **Page padding**: `px-4 py-6` mobile, `px-6 py-8` desktop
- **Card padding**: `p-6`
- **Section gap**: `gap-6` between modules

## Components

Use shadcn-style primitives from `components/ui/`:

- `Button` — primary (navy), outline, accent (gold)
- `Card` — white surface on cream background
- `Avatar`, `Badge`, `Tabs`, `DropdownMenu`, `Separator`
- `Input` — search and form fields

## Shell

`AppShell` provides global navigation:

- Nav: 首页 / 发现 / 话题 / 系列 / 星系 / 指南
- Center search bar
- 创作 button → `/studio`
- Notification & message placeholders
- Avatar link → profile or login

## Page specs

- [Home](./pages/home.md)
- [Creation Space](./pages/creation-space.md)
- [Editor](./pages/editor.md)

## Accessibility

- Minimum contrast 4.5:1 for body text on cream
- Focus rings use accent gold
- Interactive targets ≥ 44px where possible
