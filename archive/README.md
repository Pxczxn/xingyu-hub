# archive/ — 已归档，不再维护

本目录存放**已停止维护**的代码，仅作历史留存与取证用途。

> **规则：不要从这里 import、不要从这里拷贝、不要基于这里做新功能。**
> 归档目录里的代码不参与构建、不跑测试、不接收修复。它存在只是为了让
> 「这个能力以前是怎么做的」这个问题还能被回答。

---

## `xingyu-web-legacy/`

**Legacy 用户端 Web**，2026-09-28 归档（Phase 3I 之后）。

### 它是什么

一个 **Vite SPA**，但目录形状模仿 Next.js App Router —— 全站 138 个
`app/**/page.tsx`，配一套 Vite alias shim 把它当普通 React 组件树跑起来。
**没有 `next` 依赖**（`package.json` 里没有），所以「这是 Next.js」是错觉；
见 `docs/codebase/CONCERNS.md` 的同名条目。

### 为什么归档

前端**反向收敛**决策：`xingyu-web-next/`（Web V2）是唯一保留的用户端。
Legacy 的页面地图比 V2 大，但它不是产品真源——真源是后端契约与产品文档。
V2 已补齐 Legacy 拥有的全部真实能力，因此 Legacy 从「增量迁移来源」变为
「历史存档」。

### 归档时点的事实

- **已跟踪文件 407 个**，全部用 `git mv` 移入本目录，历史可用
  `git log --follow` 追溯，不是复制。
- **`public/` 286 个文件在磁盘上，但只有 10 个进过 git**（`brand/`、`images/`）。
  其余 276 个在 `public/prototype-assets/` 下，被根 `.gitignore`
  第 154 行 `prototype-assets/` 全局忽略，**从未被跟踪**。
  它们**只存在于本地磁盘**——`git mv` 不会删除磁盘内容，所以移动后仍在
  `public/prototype-assets/` 原位。**这是这批原型的唯一副本**，
  若需长期留存须单独备份（它们不在任何 commit 里）。
- **无 CI、无 Dockerfile、无部署脚本**引用本目录；根目录也没有 `package.json`。
  归档它不会让任何流水线失败。

### 仍会引用本目录的工具

以下脚本硬编码了 `xingyu-web/` 路径，归档后**必须同步改成
`archive/xingyu-web-legacy/`**，否则会因找不到文件而失效：

| 文件 | 行 | 用途 |
|------|----|------|
| `tools/generate-api-inventory.mjs` | 58 / 72 / 210 | 从 Legacy `lib/community-api.ts` 抽取 API 清单 |
| `scripts/scan-refactor-inventory.mjs` | 10 | `const WEB = join(ROOT, "xingyu-web")` |

`maintenance/legacy-scripts/` 下的三个脚本（`delete-deprecated-pages.mjs`、
`replace-user-links.mjs` 等）也硬编码了 `xingyu-web/` 路径。
**它们是针对已归档代码的一次性历史脚本，保持原样即可**——重跑它们
既无意义也危险（`delete-deprecated-pages.mjs` 直接 `unlink`，无 dry-run）。

### 如果想彻底删除它

先确认两件事，再动手：

1. **`public/prototype-assets/` 的 276 个文件是否有别处副本。** 没有的话，
   删除即永久丢失（见上）。
2. **确认不再需要回答「Legacy 怎么做的」这类取证问题。**
   `docs/codebase/LEGACY-DELTA.md` 是当时的差异清点，但它是**结论**，
   不是**证据**——证据在这个目录里。

删除本身是一行 `git rm -r archive/xingyu-web-legacy`，不需要本目录之外
任何改动（前提是上面的工具脚本已经改完或确认不再运行）。
