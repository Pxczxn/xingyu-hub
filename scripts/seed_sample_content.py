#!/usr/bin/env python3
"""Seed sample articles, series, topics links and search index for the xingyu-hub DEV database.

WARNING — this script WRITES example data into the DEVELOPMENT database.
It is intended for local development only. Run it only against a disposable local database.
It performs INSERTs; some rows use ON DUPLICATE KEY UPDATE, but article rows are always new,
so re-running accumulates more articles.

Identity IDs (owner / space / admin) are NOT hardcoded. They must be supplied via environment
variables so the script stays free of any real user, space, password or token.
The database password is also read from the environment (scripts/local-db.env), never from code.

Required environment variables (fail fast if any is missing):
  SEED_USER_ID            owner of the first set of sample articles / primary space
  SEED_SPACE_ID           primary sample space id
  SEED_SECOND_USER_ID     owner of the second set of sample articles
  SEED_SECOND_SPACE_ID    second sample space id
  SEED_ADMIN_USER_ID      admin account that approves the seeded articles

Optional environment variables:
  SEED_EXISTING_PUBLISHED_ID   if set, also (re)index this already-published article id
  DB_HOST / DB_PORT / DB_USERNAME / DB_NAME   connection overrides (defaults below are standard local dev)
  DB_PASSWORD                                       required; read from scripts/local-db.env
  SEED_COVER_BASE_URL                              cover image base url (localhost dev default)

Usage:
  set -a; source scripts/local-db.env; set +a
  export SEED_USER_ID=... SEED_SPACE_ID=... SEED_SECOND_USER_ID=... SEED_SECOND_SPACE_ID=... SEED_ADMIN_USER_ID=...
  python scripts/seed_sample_content.py                # write
  python scripts/seed_sample_content.py --dry-run      # only show what would be written
"""

from __future__ import annotations

import argparse
import os
import sys
import uuid
from datetime import datetime, timezone

import pymysql


def _require_env(name: str, purpose: str) -> str:
    """Read a required identity id from the environment; fail fast with a clear message."""
    val = os.environ.get(name)
    if not val:
        raise SystemExit(
            f"缺少必需环境变量 {name}（{purpose}）。\n"
            f"  请提供后再运行，例如：export {name}=<your-dev-{name.split('_')[-1].lower()}-id>"
        )
    return val


# --- Required identity IDs (no personal defaults — fail fast if missing) ---
SEED_USER_ID = _require_env("SEED_USER_ID", "owner of the first set of sample articles / primary space")
SEED_SPACE_ID = _require_env("SEED_SPACE_ID", "primary sample space id")
SEED_SECOND_USER_ID = _require_env("SEED_SECOND_USER_ID", "owner of the second set of sample articles")
SEED_SECOND_SPACE_ID = _require_env("SEED_SECOND_SPACE_ID", "second sample space id")
SEED_ADMIN_USER_ID = _require_env("SEED_ADMIN_USER_ID", "admin account that approves the seeded articles")

# Optional: (re)index an already-published article into the search / topic tables.
SEED_EXISTING_PUBLISHED_ID = os.environ.get("SEED_EXISTING_PUBLISHED_ID")

# --- Database connection (no credentials in this file) ---
_pwd = os.environ.get("DB_PASSWORD")
if not _pwd:
    raise SystemExit(
        "缺少 DB_PASSWORD 环境变量。\n"
        "  本地：set -a; source scripts/local-db.env; set +a"
    )
DB = dict(
    host=os.environ.get("DB_HOST", "localhost"),
    port=int(os.environ.get("DB_PORT", "3306")),
    user=os.environ.get("DB_USERNAME", "root"),
    password=_pwd,
    database=os.environ.get("DB_NAME", "xingyu_hub"),
    charset="utf8mb4",
)

BASE_URL = os.environ.get("SEED_COVER_BASE_URL", "http://localhost:7779/api/files/seed/covers")

# Standard seed topic taxonomy IDs (content taxonomy, not personal identity).
# These reference the topic rows created by the database migrations.
TOPICS = {
    "general": "01900000-0000-7000-8000-000000000001",
    "tech": "01900000-0000-7000-8000-000000000003",
    "design": "01900000-0000-7000-8000-000000000004",
    "startup": "01900000-0000-7000-8000-000000000005",
    "ai": "01900000-0000-7000-8000-000000000006",
    "opensource": "01900000-0000-7000-8000-000000000007",
    "reading": "01900000-0000-7000-8000-000000000008",
    "life": "01900000-0000-7000-8000-000000000009",
}

ARTICLES = [
    {
        "owner_id": SEED_USER_ID,
        "space_id": SEED_SPACE_ID,
        "title": "如何用 Spring Boot 搭建可扩展的后端服务",
        "published_at": datetime(2026, 9, 7, 10, 30, 0),
        "slug": "spring-boot-scalable-backend",
        "summary": "从模块划分、接口契约到可观测性，梳理一套适合社区内容平台的后端工程实践。",
        "topic": "tech",
        "cover": "cover-spring-boot.png",
        "body": """## 为什么从分层开始

可扩展的后端并不是一开始就把所有能力堆进一个模块，而是先明确边界：账号、内容、搜索、通知各自独立演进。

## 三个关键实践

1. **接口先行**：对外只暴露稳定 DTO，内部实体可以自由调整。
2. **事件驱动**：发布、审核、索引更新通过可靠事件解耦，避免事务链过长。
3. **可观测性默认开启**：慢 SQL、接口耗时、错误率要在第一天就可见。

## 小结

当你准备支撑更多创作者与读者时，先把工程结构做对，比过早优化性能更重要。
""",
    },
    {
        "owner_id": SEED_USER_ID,
        "space_id": SEED_SPACE_ID,
        "title": "分层架构下的接口设计：让前后端协作更顺畅",
        "published_at": datetime(2026, 9, 5, 14, 20, 0),
        "slug": "layered-api-design",
        "summary": "第二篇：讨论 DTO、错误码、分页与幂等，减少联调时的来回沟通。",
        "topic": "tech",
        "cover": "cover-spring-boot.png",
        "body": """## 统一响应结构

社区产品的前端会同时消费列表、详情、变更结果。统一 envelope 可以显著降低适配成本。

## 错误要可行动

不要只返回“参数错误”，而是告诉调用方哪个字段、为什么、如何修正。

## 分页与游标

推荐列表优先使用 cursor，避免深分页在数据量增长后拖垮数据库。

## 实践建议

每次新增接口，都补一条集成测试，保证契约不会在重构中悄悄漂移。
""",
    },
    {
        "owner_id": SEED_SECOND_USER_ID,
        "space_id": SEED_SECOND_SPACE_ID,
        "title": "产品设计师必须掌握的 5 个交互原则",
        "published_at": datetime(2026, 8, 30, 9, 15, 0),
        "slug": "five-interaction-principles",
        "summary": "一致性、反馈、容错、渐进披露与可逆操作，是内容社区里最常见的体验底座。",
        "topic": "design",
        "cover": "cover-design.png",
        "body": """## 1. 一致性

相同动作在不同页面应有相同文案与位置，例如“关注”“取消关注”。

## 2. 即时反馈

点赞、收藏、发布成功都需要明确反馈，空状态也要给出下一步。

## 3. 容错

表单错误尽量就地提示，并提供恢复路径。

## 4. 渐进披露

首页只呈现最重要的信息，把高级设置留给需要的用户。

## 5. 可逆操作

删除、隐藏、移出系列等破坏性操作必须可撤销或二次确认。
""",
    },
    {
        "owner_id": SEED_SECOND_USER_ID,
        "space_id": SEED_SECOND_SPACE_ID,
        "title": "从 0 到 1：独立开发者的第一年",
        "published_at": datetime(2026, 8, 25, 16, 45, 0),
        "slug": "indie-dev-first-year",
        "summary": "不是融资故事，而是关于节奏、作品沉淀与社区反馈的真实记录。",
        "topic": "startup",
        "cover": "cover-startup.png",
        "body": """## 先做出可读的东西

第一年的目标不是完美，而是持续发布。每周一篇短文，也比一个从未上线的宏大计划更有价值。

## 找到真实用户

把作品放到可被发现的入口，观察读者停留、收藏与追问，而不是只看点赞数。

## 控制范围

功能清单越长，交付越慢。独立开发者最稀缺的资源是注意力。

## 给下一年的自己

留一份公开写作记录，你会惊讶于自己已经走了多远。
""",
    },
    {
        "owner_id": SEED_USER_ID,
        "space_id": SEED_SPACE_ID,
        "title": "大语言模型在内容创作中的实践边界",
        "published_at": datetime(2026, 8, 20, 11, 0, 0),
        "slug": "llm-content-boundaries",
        "summary": "AI 可以加速草稿与润色，但主题判断、事实核对与表达立场仍应属于作者。",
        "topic": "ai",
        "cover": "cover-ai.png",
        "body": """## 适合 AI 协助的环节

- 提纲扩展与结构建议
- 标题备选与摘要压缩
- 语法与可读性润色

## 需要人主导的环节

- 核心观点与价值判断
- 引用、数据与事实核验
- 涉及经验与态度的表达

## 社区里的基本共识

可以借助工具，但不应把未经核对的内容直接当作最终发布稿。
""",
    },
    {
        "owner_id": SEED_SECOND_USER_ID,
        "space_id": SEED_SECOND_SPACE_ID,
        "title": "我为什么开始写开源项目",
        "published_at": datetime(2026, 8, 15, 20, 30, 0),
        "slug": "why-i-write-opensource",
        "summary": "开源不是炫技，而是把可复用的解法留给下一位遇到同样问题的人。",
        "topic": "opensource",
        "cover": "cover-opensource.png",
        "body": """## 从重复劳动开始

当第三次复制粘贴同一套脚手架代码时，就该考虑把它抽出来。

## 文档与示例同样重要

没有 README 与最小示例的项目，很难真正帮到社区。

## 维护是一种承诺

开源的价值在于持续响应 issue 与保持兼容，而不是一次性上传代码。

## 回报

最大的回报通常不是 star 数，而是有人告诉你：你的项目帮他省了一下午。
""",
    },
    {
        "owner_id": SEED_USER_ID,
        "space_id": SEED_SPACE_ID,
        "title": "深夜读书：三本书带给我的思考",
        "published_at": datetime(2026, 8, 10, 22, 10, 0),
        "slug": "late-night-reading-notes",
        "summary": "关于方法、写作与长期主义的三本小书，以及它们如何影响内容创作。",
        "topic": "reading",
        "cover": "cover-reading.png",
        "body": """## 《如何阅读一本书》

阅读不是被动接收，而是带着问题与作者对话。

## 《写作这回事》

好文字来自日常观察，而不是等灵感降临。

## 《长期主义》

在内容平台里，持续输出比偶尔爆款更能建立信任。

## 我的做法

每读完一本，就写一段不超过 300 字的公开笔记，把思考留在外面。
""",
    },
    {
        "owner_id": SEED_SECOND_USER_ID,
        "space_id": SEED_SECOND_SPACE_ID,
        "title": "周末城市漫步：重新学会慢下来",
        "published_at": datetime(2026, 8, 5, 18, 50, 0),
        "slug": "weekend-city-walk",
        "summary": "在高信息密度的工作之外，用一次没有目的的散步恢复注意力。",
        "topic": "life",
        "cover": "cover-reading.png",
        "body": """## 不带目的地

不查地图，不赶时间，只记录三个让你停下来的瞬间。

## 观察细节

老店的招牌、路人的对话、光线落在墙面上的角度，都是写作的素材。

## 写下来的价值

生活类内容不必宏大，真实而具体就足够让人共鸣。
""",
    },
]

SERIES = [
    {
        "owner_id": SEED_USER_ID,
        "space_id": SEED_SPACE_ID,
        "title": "后端工程入门",
        "slug": "backend-engineering-intro",
        "description": "面向社区平台的后端工程实践，从架构到接口协作。",
        "article_slugs": ["spring-boot-scalable-backend", "layered-api-design"],
    },
    {
        "owner_id": SEED_SECOND_USER_ID,
        "space_id": SEED_SECOND_SPACE_ID,
        "title": "独立创作者手记",
        "slug": "indie-creator-notes",
        "description": "关于产品、写作与社区反馈的连续记录。",
        "article_slugs": ["indie-dev-first-year", "why-i-write-opensource"],
    },
]


def new_id() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def cover_url(filename: str) -> str:
    return f"{BASE_URL}/{filename}"


def seed_published_article(cur, spec: dict, published_at: datetime) -> str:
    article_id = new_id()
    draft_id = new_id()
    revision_id = new_id()
    submission_id = new_id()
    decision_id = new_id()
    published_id = new_id()
    search_id = new_id()
    seo_id = new_id()

    cur.execute(
        """
        INSERT INTO article (id, space_id, owner_id, category_id, status, lifecycle_status, moderation_status, created_at, updated_at)
        VALUES (%s, %s, %s, NULL, 'PUBLISHED', 'ACTIVE', 'NORMAL', %s, %s)
        """,
        (article_id, spec["space_id"], spec["owner_id"], published_at, published_at),
    )
    cur.execute(
        """
        INSERT INTO working_draft (id, article_id, title, summary, body_mode, body, slug, visibility, lock_version, created_at, updated_at)
        VALUES (%s, %s, %s, %s, 'MARKDOWN', %s, %s, 'PUBLIC', 1, %s, %s)
        """,
        (
            draft_id,
            article_id,
            spec["title"],
            spec["summary"],
            spec["body"],
            spec["slug"],
            published_at,
            published_at,
        ),
    )
    cur.execute(
        """
        INSERT INTO formal_revision (id, article_id, revision_number, title, summary, body_mode, body, slug, visibility, source_draft_lock_version, frozen_at, created_at)
        VALUES (%s, %s, 1, %s, %s, 'MARKDOWN', %s, %s, 'PUBLIC', 1, %s, %s)
        """,
        (
            revision_id,
            article_id,
            spec["title"],
            spec["summary"],
            spec["body"],
            spec["slug"],
            published_at,
            published_at,
        ),
    )
    cur.execute(
        """
        INSERT INTO review_submission (id, article_id, formal_revision_id, submitted_by, status, submitted_at)
        VALUES (%s, %s, %s, %s, 'APPROVED', %s)
        """,
        (submission_id, article_id, revision_id, spec["owner_id"], published_at),
    )
    cur.execute(
        """
        INSERT INTO review_decision (id, submission_id, decision, decided_by, comment, decided_at)
        VALUES (%s, %s, 'APPROVED', %s, 'seed approved', %s)
        """,
        (decision_id, submission_id, SEED_ADMIN_USER_ID, published_at),
    )
    cur.execute(
        """
        INSERT INTO published_revision (id, article_id, formal_revision_id, published_at, publication_event_id)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (published_id, article_id, revision_id, published_at, f"seed-publication:{article_id}"),
    )
    cur.execute(
        """
        INSERT INTO search_document (id, object_type, object_id, title, summary, discovery_version, indexed_at, removed_at)
        VALUES (%s, 'ARTICLE', %s, %s, %s, 1, %s, NULL)
        ON DUPLICATE KEY UPDATE title=VALUES(title), summary=VALUES(summary), indexed_at=VALUES(indexed_at), removed_at=NULL
        """,
        (search_id, article_id, spec["title"], spec["summary"], published_at),
    )
    cur.execute(
        """
        INSERT INTO article_topic (article_id, topic_id, created_at)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE created_at=VALUES(created_at)
        """,
        (article_id, TOPICS[spec["topic"]], published_at),
    )
    cur.execute(
        """
        INSERT INTO seo_metadata (id, object_type, object_id, title, description, canonical_url, og_image_url, updated_at)
        VALUES (%s, 'ARTICLE', %s, %s, %s, NULL, %s, %s)
        ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), og_image_url=VALUES(og_image_url), updated_at=VALUES(updated_at)
        """,
        (
            seo_id,
            article_id,
            spec["title"],
            spec["summary"],
            cover_url(spec["cover"]),
            published_at,
        ),
    )
    return article_id


def index_existing_article(cur, existing_id: str) -> None:
    cur.execute(
        """
        SELECT fr.title, fr.summary, pr.published_at
        FROM published_revision pr
        JOIN formal_revision fr ON fr.id = pr.formal_revision_id
        WHERE pr.article_id = %s
        """,
        (existing_id,),
    )
    row = cur.fetchone()
    if not row:
        return
    title, summary, published_at = row
    cur.execute(
        """
        INSERT INTO search_document (id, object_type, object_id, title, summary, discovery_version, indexed_at, removed_at)
        VALUES (%s, 'ARTICLE', %s, %s, %s, 1, %s, NULL)
        ON DUPLICATE KEY UPDATE title=VALUES(title), summary=VALUES(summary), indexed_at=VALUES(indexed_at), removed_at=NULL
        """,
        (new_id(), existing_id, title, summary, published_at),
    )
    cur.execute(
        """
        INSERT INTO article_topic (article_id, topic_id, created_at)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE created_at=VALUES(created_at)
        """,
        (existing_id, TOPICS["general"], published_at),
    )


def seed_series(cur, spec: dict, slug_to_id: dict[str, str], now: datetime) -> str:
    series_id = new_id()
    cur.execute(
        """
        INSERT INTO series (id, owner_id, space_id, title, slug, description, status, lock_version, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, 'ACTIVE', 0, %s, %s)
        """,
        (
            series_id,
            spec["owner_id"],
            spec["space_id"],
            spec["title"],
            spec["slug"],
            spec["description"],
            now,
            now,
        ),
    )
    for position, article_slug in enumerate(spec["article_slugs"], start=1):
        article_id = slug_to_id[article_slug]
        cur.execute(
            """
            INSERT INTO series_chapter (id, series_id, article_id, position, created_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (new_id(), series_id, article_id, position, now),
        )
    cur.execute(
        """
        INSERT INTO search_document (id, object_type, object_id, title, summary, discovery_version, indexed_at, removed_at)
        VALUES (%s, 'SERIES', %s, %s, %s, 1, %s, NULL)
        ON DUPLICATE KEY UPDATE title=VALUES(title), summary=VALUES(summary), indexed_at=VALUES(indexed_at), removed_at=NULL
        """,
        (new_id(), series_id, spec["title"], spec["description"], now),
    )
    return series_id


def seed_featured(cur, object_type: str, object_id: str, sort_order: int, now: datetime) -> None:
    cur.execute(
        """
        INSERT INTO featured_content (id, object_type, object_id, sort_order, status, created_at)
        VALUES (%s, %s, %s, %s, 'ACTIVE', %s)
        ON DUPLICATE KEY UPDATE sort_order=VALUES(sort_order), status='ACTIVE'
        """,
        (new_id(), object_type, object_id, sort_order, now),
    )


def print_plan() -> None:
    """Print the data/actions that would be written, without connecting to or writing the DB."""
    print("=== DRY RUN: planned seed (no database writes) ===")
    print(f"Target DB : {DB['host']}:{DB['port']}/{DB['database']} (user={DB['user']})")
    print(f"Admin ID  : {SEED_ADMIN_USER_ID}")
    print(f"Primary   : user={SEED_USER_ID} space={SEED_SPACE_ID}")
    print(f"Second    : user={SEED_SECOND_USER_ID} space={SEED_SECOND_SPACE_ID}")
    print(f"Existing published to (re)index: {SEED_EXISTING_PUBLISHED_ID or '(skipped)'}")
    print(f"Articles ({len(ARTICLES)}):")
    for a in ARTICLES:
        print(f"  - [{a['topic']}] {a['title']} (owner={a['owner_id']}, space={a['space_id']}, at={a['published_at']})")
    print(f"Series ({len(SERIES)}):")
    for s in SERIES:
        print(f"  - {s['title']} (owner={s['owner_id']}, space={s['space_id']}, articles={s['article_slugs']})")
    print("=== DRY RUN complete ===")


def main() -> None:
    print("⚠️  WARNING: this script will WRITE example data into the DEVELOPMENT database.", file=sys.stderr)
    print(f"   Target: {DB['host']}:{DB['port']}/{DB['database']} (user={DB['user']})", file=sys.stderr)
    print("   Ensure this is a disposable local dev database. Abort now (Ctrl+C) if unsure.", file=sys.stderr)

    now = utc_now()
    conn = pymysql.connect(**DB)
    try:
        with conn.cursor() as cur:
            slug_to_id: dict[str, str] = {}
            article_ids: list[str] = []

            if SEED_EXISTING_PUBLISHED_ID:
                index_existing_article(cur, SEED_EXISTING_PUBLISHED_ID)

            for spec in ARTICLES:
                published_at = spec.get("published_at", now)
                article_id = seed_published_article(cur, spec, published_at)
                slug_to_id[spec["slug"]] = article_id
                article_ids.append(article_id)

            series_ids: list[str] = []
            for spec in SERIES:
                series_ids.append(seed_series(cur, spec, slug_to_id, now))

            featured_slugs = [
                "spring-boot-scalable-backend",
                "five-interaction-principles",
                "llm-content-boundaries",
                "late-night-reading-notes",
            ]
            for sort_order, slug in enumerate(featured_slugs):
                seed_featured(cur, "ARTICLE", slug_to_id[slug], sort_order, now)
            seed_featured(cur, "SERIES", series_ids[0], 10, now)

        conn.commit()
        print(f"Seeded {len(article_ids)} articles, {len(series_ids)} series, search index and featured content.")
    finally:
        conn.close()


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Seed sample data into the xingyu-hub DEV database.")
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Only print the data/actions that would be written; do not connect to or write the database.",
    )
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    if args.dry_run:
        print_plan()
    else:
        main()
