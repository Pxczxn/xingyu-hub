# Frontend Dead-Code Cleanup — 待办清单

用途：集中记录已确认零引用、但因当前 WIP 归属不清而**刻意未删**的死代码。
原则：不为单个页面扩大 diff；等一个专门的 cleanup 轮次统一删除并跑全量测试。

---

## 1. `xingyu-web/src/features/home/components/AnnouncementPanel.tsx`

- **确认状态：死代码。** V2 **零 import 站点**（`grep -rn "from \"@/features/home/components/AnnouncementPanel\""` 为空，
  任何 `.ts/.tsx` 都无引用），也没有任何测试引用它。
- 仅有 3 处**注释/文档**提及：`HomeNotice.tsx:14`、`TrendingTopicsPanel.tsx:17`、
  `docs/design-system/pages/home.md:21,76`（后者记录的是已被 `HomeNotice` 取代的旧首页 IA）。
- 它导出的唯一符号是 `AnnouncementPanel`，无其它消费者。

### 为什么本轮不删

- 该文件当前处于 **uncommitted WIP 状态**（`git status` = ` M`），修改内容是更早阶段遗留的
  `accent` → `accent-strong` 对比度 token 修正（2 行）。
- 当前仓库有 **172 项未提交改动**，且引用它的 `TrendingTopicsPanel.tsx` 同为 WIP、
  `HomeNotice.tsx` 为新增未跟踪文件。
- → 删除会顺手抹掉一处归属不明的未提交修改，并把本页 diff 从「公告页」扩散到首页组件树。
  与「不为了本页扩大 diff」相冲突。

### 清理时的注意事项（将来执行）

1. 删除 `AnnouncementPanel.tsx`。
2. 同步清理 3 处注释引用：
   - `HomeNotice.tsx` 的 doc 注释中「(The old `AnnouncementPanel` is a rail module by its own
     doc comment and is currently unreferenced; it is left in place for a later cleanup.)」
     —— 这段"为后续清理保留"的说明本身也应删除。
   - `TrendingTopicsPanel.tsx:17`「see AnnouncementPanel for why the…」→ 指向 404，
     应改为直接描述该行为，或指向 `HomeNotice`。
   - `docs/design-system/pages/home.md` 的 IA 图与组件表 —— 若该文档已整体过时，
     应与其它过期段落一并处理，不要只改这两行。
3. 删除后跑 `vitest run src/features/home` 与全量测试确认无回归。
