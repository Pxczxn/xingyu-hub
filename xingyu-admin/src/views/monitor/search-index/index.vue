<template>
  <div class="page-container search-index-page">
    <!-- 页头：照抄管理端既有的 .admin-page-heading 骨架（views/monitor/cache/index.vue 同款） -->
    <header class="admin-page-heading">
      <div>
        <p class="admin-page-heading__kicker">SEARCH INDEX OPS</p>
        <h1>搜索索引</h1>
        <span class="admin-page-heading__description">观察索引投影与事件队列的健康度，必要时重建。</span>
      </div>
      <div class="admin-page-heading__actions">
        <span class="heading-updated">最后更新 {{ updatedLabel }}</span>
        <n-button quaternary size="small" :loading="loading" @click="load()">
          <template #icon><n-icon><RefreshOutline /></n-icon></template>
          刷新
        </n-button>
      </div>
    </header>

    <!-- ① 总体结论：第一眼。让「没事」的人 1 秒离开 -->
    <section class="conclusion" :class="`is-${status.level}`" role="status" aria-live="polite">
      <span class="conclusion__lamp" aria-hidden />
      <span class="conclusion__text">{{ status.headline }}</span>
      <span class="stag" :class="`is-${status.level}`">{{ status.label }}</span>
    </section>

    <!--
      ② 死信升级态。位置是刻意的：在「结论横幅」与「指标卡」之间。
      出事的人要立刻拿到「这是什么 + 我该怎么办」，而不是先滚过五个数字。
      这是一次故意打破克制的升级 —— 它是功能，不是装饰，不要以「不够精致」为由弱化它。
    -->
    <section v-if="isDeadLetter" class="deadletter">
      <div class="deadletter__head">
        <span class="stag is-danger">需要人工介入</span>
        <span class="deadletter__title">{{ deadLetterCount }} 条死信事件已停止重试</span>
      </div>
      <p class="deadletter__lead">
        这些事件已脱离正常队列 —— 既不前进也不消失，系统不会再自动处理。
        <strong>在处置完成前，相关内容不会出现在搜索结果中。</strong>
      </p>
      <div class="deadletter__grid">
        <div class="deadletter__block">
          <h3>这是什么</h3>
          <p>死信事件是「重试次数已耗尽、系统已放弃自动处理」的事件。通常只有两种成因：</p>
          <ul>
            <li><strong>消费者持续失败</strong>：事件被反复处理仍失败，重试次数耗尽。</li>
            <li>
              <strong>事件版本比当前部署更新</strong>：通常意味着<strong>发生过一次回滚</strong> ——
              事件由更新的代码写入，当前运行的版本无法识别它。
            </li>
          </ul>
        </div>
        <div class="deadletter__block">
          <h3>我该怎么办</h3>
          <ul>
            <li>先确认<strong>近期是否做过回滚或回退部署</strong>。</li>
            <li>若为回滚导致：<strong>重新部署对应版本</strong>，或清理该批事件后<strong>再执行一次全量重建</strong>。</li>
            <li>若并非回滚：<strong>检查消费者日志</strong>，定位持续失败的根因后再处理。</li>
          </ul>
        </div>
      </div>
      <p class="deadletter__foot">
        本页只呈现死信数量：后端未提供逐条详情接口，因此这里不提供「点进去看」，
        也不提供「一键修复」—— 这类事件必须人工判断。
      </p>
    </section>

    <!-- ③ 五指标：两组并排，必须一起看 -->
    <n-card size="small" class="metrics-card">
      <template #header>
        <div class="card-head">
          <span class="card-head__title">健康总览</span>
          <span class="micro">每 {{ POLL_INTERVAL_SECONDS }} 秒自动刷新</span>
        </div>
      </template>

      <p class="metric-caption">
        两组必须一起看：索引投影正常但事件队列在涨，同样是不健康。
      </p>

      <div class="metric-groups">
        <div class="metric-group">
          <div class="metric-group__head">
            <span class="metric-group__title">索引投影 · 现状存量</span>
            <span class="metric-group__sub">内容在索引中的当前状态</span>
          </div>
          <div class="metric-grid">
            <div class="metric" :class="`is-${metricLevel('indexed')}`">
              <div class="metric__label"><span class="metric__dot" aria-hidden />在索引中的行数</div>
              <div class="metric__row"><span class="metric__value">{{ display('indexed') }}</span></div>
              <div class="metric__hint">当前可被搜索到的公开内容行数</div>
            </div>
            <div class="metric" :class="`is-${metricLevel('removed')}`">
              <div class="metric__label"><span class="metric__dot" aria-hidden />已标记移除</div>
              <div class="metric__row"><span class="metric__value">{{ display('removed') }}</span></div>
              <div class="metric__hint">标记为非公开但保留的行数，属正常存量，不告警</div>
            </div>
          </div>
        </div>

        <div class="metric-group">
          <div class="metric-group__head">
            <span class="metric-group__title">事件队列 · 动态流量</span>
            <span class="metric-group__sub">重建与同步的压力</span>
          </div>
          <div class="metric-grid">
            <div class="metric" :class="`is-${metricLevel('pendingEvents')}`">
              <div class="metric__label">
                <span class="metric__dot" aria-hidden />待处理
                <span class="trend" :class="`trend--${trend.dir}`">{{ trend.text }}</span>
              </div>
              <div class="metric__row">
                <span class="metric__value" :class="{ 'is-signal': pendingIsSignal }">{{
                  display('pendingEvents')
                }}</span>
              </div>
              <div class="metric__hint">排队与处理中的事件；持续不降说明消费者可能卡住</div>
            </div>
            <div class="metric" :class="`is-${metricLevel('failedEvents')}`">
              <div class="metric__label"><span class="metric__dot" aria-hidden />失败待重试</div>
              <div class="metric__row"><span class="metric__value">{{ display('failedEvents') }}</span></div>
              <div class="metric__hint">失败但会重试；通常会自愈，持续增长才需关注</div>
            </div>
            <div class="metric" :class="`is-${metricLevel('isolatedEvents')}`">
              <div class="metric__label"><span class="metric__dot" aria-hidden />死信</div>
              <div class="metric__row"><span class="metric__value">{{ display('isolatedEvents') }}</span></div>
              <div class="metric__hint">已停止重试，需人工介入；这是唯一需要人判断的指标</div>
            </div>
          </div>
        </div>
      </div>
    </n-card>

    <!-- ④ 运维操作 -->
    <n-card size="small">
      <template #header><span class="card-head__title">运维操作</span></template>

      <div class="op-row">
        <div class="op-row__text">
          <p class="op-row__title">全量重建索引</p>
          <p class="op-row__desc">
            把所有应入索引的内容重新加入事件队列。
            <strong>这是排队，不是立即执行</strong> —— 提交后索引会逐步更新，页面不会立刻变化。
            消费速率约 {{ DRAIN_RATE_PER_SECOND }} 条/秒，积压较多时需要较长时间。
          </p>
        </div>
        <button
          type="button"
          class="btn-heavy"
          :class="{ 'is-cooling': cooldownSeconds > 0 }"
          :disabled="rebuildPending"
          @click="confirmRebuildAll"
        >
          <span class="btn-heavy__spark" aria-hidden />
          {{ cooldownSeconds > 0 ? `已排队 · 冷却 ${cooldownSeconds}s` : '全量重建索引' }}
        </button>
      </div>

      <p v-if="queuedNotice" class="queued-notice" role="status">
        <n-icon><CheckmarkCircleOutline /></n-icon>
        <span>{{ queuedNotice }}</span>
      </p>
    </n-card>

    <!-- 单资源重建：同步执行，表单默认折叠 -->
    <n-card size="small">
      <template #header>
        <div class="card-head">
          <span class="card-head__title">单资源重建</span>
          <span class="stag is-idle">同步 · 立即生效</span>
        </div>
      </template>

      <p class="muted">
        针对单个内容资源重建索引。同步执行，完成后立即生效；失败会就地报错。
      </p>

      <n-collapse>
        <n-collapse-item title="展开重建表单" name="resource">
          <n-form label-placement="top" :show-require-mark="true">
            <div class="form-grid">
              <n-form-item label="资源类型 objectType" required>
                <n-select v-model:value="objectType" :options="objectTypeOptions" />
              </n-form-item>
              <n-form-item label="资源 ID objectId" required>
                <n-input v-model:value="objectId" placeholder="请输入资源 ID，例如 1042" clearable />
              </n-form-item>
            </div>
          </n-form>

          <p v-if="resourceFeedback" class="feedback" :class="`is-${resourceFeedback.kind}`" role="status">
            {{ resourceFeedback.text }}
          </p>

          <n-button type="primary" :loading="resourcePending" @click="submitRebuildOne">
            重建该资源
          </n-button>
        </n-collapse-item>
      </n-collapse>
    </n-card>

    <!-- ⑤ 指标说明与健康阈值（折叠） -->
    <n-collapse class="legend">
      <n-collapse-item title="指标说明与健康阈值" name="legend">
        <div class="deadletter__grid">
          <div class="deadletter__block">
            <h3>索引投影（存量）</h3>
            <p>
              <strong>在索引中的行数</strong>：当前可被搜索到的公开内容。
              <strong>已标记移除</strong>：标记为非公开但保留的行数，属正常存量，不触发告警。
            </p>
            <h3>事件队列（流量）</h3>
            <p>
              反映重建与同步的压力。索引正常但队列持续增长，说明内容正在变更、索引正在追赶，
              此时视为不健康。
            </p>
          </div>
          <div class="deadletter__block">
            <h3>健康阈值（前端经验值）</h3>
            <ul>
              <li>待处理 ≥ {{ BACKLOG_THRESHOLD }}：视为积压，提示注意。</li>
              <li>失败待重试 &gt; 0：提示注意，但通常会自愈。</li>
              <li>死信 &gt; 0：需人工介入，全局升级为红色。</li>
              <li>红色<strong>只留给死信</strong>，以避免真出事时红色失去意义。</li>
            </ul>
            <p class="micro">
              阈值是前端的经验值，不是后端返回的判定 —— 接口只给数字。
            </p>
          </div>
        </div>
      </n-collapse-item>
    </n-collapse>

    <!--
      ⑥ 本次会话操作（折叠）
      原型里这一块是「重建历史」表格，但后端没有历史接口，表格只能永远是「—」。
      与其放一张永远空着的表，不如如实记录【本次会话】触发过的操作 —— 这是真实数据，
      而且正好回答运营「我刚才点了什么」。跨会话的历史需要后端接口，本页不假装有。
    -->
    <n-collapse class="legend">
      <n-collapse-item title="本次会话操作" name="session">
        <p v-if="sessionLog.length === 0" class="muted">本次会话还没有触发过重建操作。</p>
        <table v-else class="session-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>操作</th>
              <th>对象</th>
              <th class="num">入队条数</th>
              <th>结果</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(entry, index) in sessionLog" :key="index">
              <td class="tnum">{{ entry.at }}</td>
              <td>{{ entry.action }}</td>
              <td>{{ entry.target }}</td>
              <td class="num">{{ entry.queued }}</td>
              <td>{{ entry.result }}</td>
            </tr>
          </tbody>
        </table>
        <p class="micro">仅记录本页本次打开的会话；跨会话的操作历史需要后端提供接口。</p>
      </n-collapse-item>
    </n-collapse>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NSelect,
  useDialog,
  type SelectOption
} from 'naive-ui'
import { CheckmarkCircleOutline, RefreshOutline } from '@vicons/ionicons5'
import {
  searchIndexApi,
  type SearchIndexHealth,
  type SearchIndexObjectType
} from '@/api/search-index'

/*
 * 搜索索引运维页。
 *
 * 受众是平台运营 / 运维（技术水位中等，不看日志不看库），页面本质是「出事才来」：
 * 要么没事（1 秒确认后离开），要么已经出事（有压力，要明确的下一步）。两种极端都要服务好。
 *
 * 三个关键交互（照需求与设计文档实现，不要「优化」掉）：
 *   1. 全量重建只入队不同步执行 → 用文案提前管理预期 + 把 pendingEvents 当进度信号 +
 *      按钮冷却但【不禁用】（幂等）。**不做假进度条 / 假百分比。**
 *   2. 死信只有数量、没有详情接口 → 常显升级态 + 说清两种成因 + 给可执行下一步。
 *      **不给假按钮。**
 *   3. 危险操作二次确认；单资源重建表单默认折叠 + 就地反馈。
 *
 * ⚠️ 禁用 naive 的 type="warning" / type="info"：管理端 App.vue:81-84 把 warningColor
 * 覆盖成了主色、166-170 把 Tag.colorInfo 也染成主色，这两个类型渲染出来是【主色而不是琥珀/蓝】，
 * 而且不报错。所以「注意」语义一律走下面的自建状态令牌。
 * 详见 docs/design-system/admin/search-index-ops.DESIGN.md §4 / §8。
 */

/** 轮询间隔。10–15s 是经验值：再慢看不到 pending 下降，再快对后端是噪音。 */
const POLL_INTERVAL_SECONDS = 10
const POLL_INTERVAL_MS = POLL_INTERVAL_SECONDS * 1000

/** 待处理超过这个量视为积压。前端经验值 —— 接口只给数字，不给判定。 */
const BACKLOG_THRESHOLD = 500

/** 后端消费速率（BATCH_SIZE=20 / 5s 轮询）。写进文案是为了让运营对耗时有个预期。 */
const DRAIN_RATE_PER_SECOND = 4

/** 趋势窗口长度：6 个采样点 ≈ 1 分钟。 */
const TREND_WINDOW = 6

/** 重建按钮的冷却秒数。幂等操作，冷却只是抑制无意义的重复排队，**不禁用**。 */
const COOLDOWN_SECONDS = 30

type Level = 'ok' | 'warn' | 'danger' | 'idle'
type HealthKey = keyof SearchIndexHealth

const dialog = useDialog()

const health = ref<SearchIndexHealth | null>(null)
const loading = ref(false)
const loadFailed = ref(false)
const lastUpdatedAt = ref<Date | null>(null)

const objectType = ref<SearchIndexObjectType>('ARTICLE')
const objectId = ref('')
const resourcePending = ref(false)
const resourceFeedback = ref<{ kind: 'ok' | 'err'; text: string } | null>(null)

const rebuildPending = ref(false)
const queuedNotice = ref<string | null>(null)
const cooldownSeconds = ref(0)

const sessionLog = ref<
  { at: string; action: string; target: string; queued: string; result: string }[]
>([])

const objectTypeOptions: SelectOption[] = [
  { label: 'ARTICLE · 文章', value: 'ARTICLE' },
  { label: 'SERIES · 系列', value: 'SERIES' },
  { label: 'MOMENT · 动态', value: 'MOMENT' }
]

/** 最近若干个 pendingEvents 读数，用来算趋势方向。 */
const pendingWindow = ref<number[]>([])

// ---------------------------------------------------------------- 读取

async function load(silent = false) {
  if (!silent) loading.value = true
  try {
    const next = await searchIndexApi.health()
    health.value = next
    loadFailed.value = false
    lastUpdatedAt.value = new Date()

    pendingWindow.value = [...pendingWindow.value, next.pendingEvents].slice(-TREND_WINDOW)
  } catch {
    loadFailed.value = true
    // 轮询失败不清空已有读数：把上次的数字留着，比闪成空白更有用。
    // 但「从没读到过」时必须区别于「正在读」—— 见下面 status 的读取失败分支。
    if (!silent) health.value = null
  } finally {
    loading.value = false
  }
}

// ---------------------------------------------------------------- 派生状态

const isDeadLetter = computed(() => (health.value?.isolatedEvents ?? 0) > 0)
const deadLetterCount = computed(() => health.value?.isolatedEvents ?? 0)

/** pendingEvents 在全量重建后是「进度信号」，此时高亮它。 */
const pendingIsSignal = computed(() => cooldownSeconds.value > 0)

const status = computed<{ level: Level; headline: string; label: string }>(() => {
  const current = health.value
  if (!current) {
    /*
     * 「读不到」必须区别于「正在读」。
     * 把读取失败渲染成一个转不完的「正在读取…」，等于把【未知】说成【加载中】——
     * 运营会一直等下去，而真相是这一页此刻什么都不知道。
     * 也不能说成「健康」：不知道 ≠ 没问题。
     */
    if (loadFailed.value) {
      return {
        level: 'warn',
        headline: '无法读取索引健康数据，当前状态未知。请确认接口可用后重试。',
        label: '读取失败'
      }
    }
    return { level: 'idle', headline: '正在读取索引健康…', label: '读取中' }
  }
  if (current.isolatedEvents > 0) {
    return {
      level: 'danger',
      headline: `${current.isolatedEvents} 条死信事件已停止重试，需要人工确认。`,
      label: '需要人工介入'
    }
  }
  const notes: string[] = []
  if (current.pendingEvents >= BACKLOG_THRESHOLD) {
    notes.push(`事件队列积压 ${current.pendingEvents} 条`)
  }
  if (current.failedEvents > 0) {
    notes.push(`${current.failedEvents} 条事件待重试`)
  }
  if (notes.length > 0) {
    return {
      level: 'warn',
      headline: `${notes.join('，')}。通常可自愈，建议观察是否持续。`,
      label: '需要注意'
    }
  }
  // 读数过旧（轮询连续失败）时，不要在旧数据上继续报「健康」。
  if (loadFailed.value) {
    return {
      level: 'warn',
      headline: '最近一次刷新失败，以下是最后一次成功读取的数据，可能已经过时。',
      label: '数据可能过时'
    }
  }
  return { level: 'ok', headline: '索引与事件队列均正常，无需处理。', label: '索引健康' }
})

/**
 * 趋势方向。
 *
 * ⚠️ 「持平」不等于「正常」：高位持平是【持续积压】，而低位持平才是平稳。
 * 一个卡住不降的积压配一个「平稳」，恰好会把本页最该抓的故障说轻。
 */
const trend = computed<{ dir: 'up' | 'down' | 'stalled' | 'flat'; text: string }>(() => {
  // 变量名不叫 window —— 那会遮蔽全局的 window。
  const samples = pendingWindow.value
  if (samples.length < 2) return { dir: 'flat', text: '— 平稳' }

  const first = samples[0]
  const last = samples[samples.length - 1]
  if (last > first) return { dir: 'up', text: '↑ 积压中' }
  if (last < first) return { dir: 'down', text: '↓ 消化中' }
  if (last >= BACKLOG_THRESHOLD) return { dir: 'stalled', text: '— 持续积压' }
  return { dir: 'flat', text: '— 平稳' }
})

function metricLevel(key: HealthKey): Level {
  const current = health.value
  if (!current) return 'idle'
  switch (key) {
    case 'isolatedEvents':
      return current.isolatedEvents > 0 ? 'danger' : 'ok'
    case 'pendingEvents':
      return current.pendingEvents >= BACKLOG_THRESHOLD ? 'warn' : 'ok'
    case 'failedEvents':
      return current.failedEvents > 0 ? 'warn' : 'ok'
    case 'removed':
      // 正常存量，不告警（需求假设 A17）。
      return 'idle'
    default:
      return 'ok'
  }
}

function display(key: HealthKey): string {
  const current = health.value
  if (!current) return '—'
  return current[key].toLocaleString('zh-CN')
}

const updatedLabel = computed(() => {
  const at = lastUpdatedAt.value
  if (!at) return '—'
  return at.toLocaleTimeString('zh-CN', { hour12: false })
})

// ---------------------------------------------------------------- 写操作

function confirmRebuildAll() {
  dialog.warning({
    title: '确认执行全量重建？',
    content:
      '将把所有应入索引的内容重新加入事件队列。这是排队，不是立即执行 —— 提交后索引会逐步更新，本页不会立刻变化。' +
      `消费速率约 ${DRAIN_RATE_PER_SECOND} 条/秒，积压较多时需要较长时间。该操作幂等，重复提交不会产生额外副作用。`,
    positiveText: '确认排队',
    negativeText: '取消',
    onPositiveClick: () => {
      void runRebuildAll()
    }
  })
}

async function runRebuildAll() {
  rebuildPending.value = true
  try {
    const result = await searchIndexApi.rebuildAll()
    queuedNotice.value = `已加入队列，共 ${result.queued.toLocaleString('zh-CN')} 条待处理。索引将逐步更新，请观察「待处理」的下降。`
    startCooldown()
    sessionLog.value.unshift({
      at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      action: '全量重建',
      target: '—',
      queued: result.queued.toLocaleString('zh-CN'),
      result: '已排队'
    })
    // 立刻拉一次：让 pendingEvents 马上变成进度信号，而不是等下一个轮询周期。
    await load(true)
  } catch (error) {
    queuedNotice.value = null
    dialog.error({
      title: '全量重建未提交成功',
      content: error instanceof Error ? error.message : '请稍后重试。',
      positiveText: '知道了'
    })
  } finally {
    rebuildPending.value = false
  }
}

let cooldownTimer: number | null = null

function startCooldown() {
  cooldownSeconds.value = COOLDOWN_SECONDS
  if (cooldownTimer !== null) window.clearInterval(cooldownTimer)
  cooldownTimer = window.setInterval(() => {
    cooldownSeconds.value -= 1
    if (cooldownSeconds.value <= 0 && cooldownTimer !== null) {
      window.clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

async function submitRebuildOne() {
  const id = objectId.value.trim()
  if (!id) {
    resourceFeedback.value = { kind: 'err', text: '请填写资源 ID。' }
    return
  }
  resourceFeedback.value = null
  resourcePending.value = true
  try {
    const result = await searchIndexApi.rebuildOne(objectType.value, id)
    resourceFeedback.value = {
      kind: 'ok',
      text: `已重建 ${result.objectType} ${result.objectId}，索引条目已更新。`
    }
    sessionLog.value.unshift({
      at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      action: '单资源重建',
      target: `${result.objectType} ${result.objectId}`,
      queued: '—',
      result: '已完成'
    })
    await load(true)
  } catch (error) {
    resourceFeedback.value = {
      kind: 'err',
      text: `重建失败：${error instanceof Error ? error.message : '未知错误'}`
    }
  } finally {
    resourcePending.value = false
  }
}

// ---------------------------------------------------------------- 轮询

let pollTimer: number | null = null

function startPolling() {
  stopPolling()
  pollTimer = window.setInterval(() => {
    // 页面不可见时不轮询：运营不会盯着一个后台标签页，而轮询是纯噪音。
    if (!document.hidden) void load(true)
  }, POLL_INTERVAL_MS)
}

function stopPolling() {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopPolling()
  } else {
    void load(true)
    startPolling()
  }
}

onMounted(() => {
  void load()
  startPolling()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (cooldownTimer !== null) window.clearInterval(cooldownTimer)
})
</script>

<style scoped>
/*
 * 本页的状态令牌。
 *
 * ⚠️ 为什么在组件里定义而不是写进 admin-polish.scss：这是本页专有的语义色，
 * 没有第二个消费者。写进全局样式表会把它们变成「全站可用」的假象。
 * 前缀 .search-index-page 限定作用域。
 *
 * ⚠️ 状态色【不跟随主色】。主色是可配置的，预设里含红色系（薄暮红 / 火山橙 / 玫瑰红），
 * 一旦跟随，「红=死信」就会失效。
 */
.search-index-page {
  --ds-ok-fg: #15803d;
  --ds-ok-bg: #e8f6ee;
  --ds-ok-line: #bfe6cf;
  --ds-ok-dot: #16a34a;
  --ds-warn-fg: #b45309;
  --ds-warn-bg: #fdf3e2;
  --ds-warn-line: #f2ddb2;
  --ds-warn-dot: #f59e0b;
  --ds-danger-fg: #c0263f;
  --ds-danger-bg: #fdecee;
  --ds-danger-line: #f5c3cd;
  --ds-danger-dot: #d03050;
  --ds-idle-fg: #526078;
  --ds-idle-bg: #f1f3f8;
  --ds-idle-line: #dde3ed;
  --ds-idle-dot: #94a3b8;
  --ds-border: #e1e6ef;
  --ds-text-muted: #5f6e85;
  --ds-text-faint: #8a97ab;
  /*
   * 卡片标题必须显式取色，不能靠继承。
   *
   * 实测（headless Chromium 量计算样式）：naive 的 `.n-card-header__main` 在**暗色下依然是
   * rgb(31,34,37)** —— 一个接近黑的浅色主题文字色，落在 #18181c 的卡片上只有 **1.11:1**，
   * 基本看不见。也就是说卡片标题的颜色**不跟随暗色主题**。
   * 这是管理端既有样式的问题（`admin-polish.scss` 只改了 `.n-card` 的背景，没管标题色），
   * 但本页要自己兜住 —— 所以给标题一个随主题翻转的令牌。
   */
  --ds-text-strong: #182b4c;

  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 暗色：浅色那套在 #18181c 上对比度会掉，前景统一换 400 级亮色（≥7:1）。 */
body.dark-theme .search-index-page {
  --ds-ok-fg: #4ade80;
  --ds-ok-bg: rgb(34 197 94 / 0.14);
  --ds-ok-line: rgb(34 197 94 / 0.34);
  --ds-ok-dot: #22c55e;
  --ds-warn-fg: #fbbf24;
  --ds-warn-bg: rgb(245 158 11 / 0.15);
  --ds-warn-line: rgb(245 158 11 / 0.36);
  --ds-warn-dot: #f59e0b;
  --ds-danger-fg: #ff7a90;
  --ds-danger-bg: rgb(248 113 113 / 0.16);
  --ds-danger-line: rgb(248 113 113 / 0.4);
  --ds-danger-dot: #f87171;
  --ds-idle-fg: #a7afbf;
  --ds-idle-bg: rgb(255 255 255 / 0.06);
  --ds-idle-line: rgb(255 255 255 / 0.12);
  --ds-idle-dot: #71717a;
  --ds-border: #3f3f46;
  --ds-text-muted: #a7afbf;
  --ds-text-faint: #8a93a3;
  --ds-text-strong: #ffffff;
}

/* ---- 页头右侧 ---- */
.heading-updated {
  font-size: 12px;
  color: var(--ds-text-muted);
  font-variant-numeric: tabular-nums;
}
.admin-page-heading__actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ---- ① 结论横幅 ---- */
.conclusion {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: 1px solid var(--ds-border);
  border-radius: 10px;
  background: var(--admin-surface-raised);
  font-size: 14px;
  line-height: 1.55;
}
.conclusion__lamp {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--ds-idle-dot);
}
.conclusion__text {
  flex: 1;
  min-width: 0;
  color: var(--admin-ink);
}
body.dark-theme .search-index-page .conclusion__text {
  color: #e7eaf0;
}
.conclusion.is-ok .conclusion__lamp {
  background: var(--ds-ok-dot);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--ds-ok-dot) 22%, transparent);
}
.conclusion.is-warn .conclusion__lamp {
  background: var(--ds-warn-dot);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--ds-warn-dot) 22%, transparent);
}
.conclusion.is-danger {
  border-color: var(--ds-danger-line);
  background: var(--ds-danger-bg);
}
.conclusion.is-danger .conclusion__lamp {
  background: var(--ds-danger-dot);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--ds-danger-dot) 24%, transparent);
}
.conclusion.is-danger .conclusion__text {
  color: var(--ds-danger-fg);
  font-weight: 600;
}

/* ---- 状态标签（自建，不走 naive 的 warning/info） ---- */
.stag {
  flex: none;
  padding: 2px 8px;
  border: 1px solid var(--ds-idle-line);
  border-radius: 6px;
  background: var(--ds-idle-bg);
  color: var(--ds-idle-fg);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  white-space: nowrap;
}
.stag.is-ok {
  border-color: var(--ds-ok-line);
  background: var(--ds-ok-bg);
  color: var(--ds-ok-fg);
}
.stag.is-warn {
  border-color: var(--ds-warn-line);
  background: var(--ds-warn-bg);
  color: var(--ds-warn-fg);
}
.stag.is-danger {
  border-color: var(--ds-danger-line);
  background: var(--ds-danger-bg);
  color: var(--ds-danger-fg);
}

/* ---- ② 死信升级态（功能，不是装饰） ---- */
.deadletter {
  padding: 16px;
  border: 1px solid var(--ds-danger-line);
  border-left: 4px solid var(--ds-danger-dot);
  border-radius: 10px;
  background: var(--ds-danger-bg);
}
.deadletter__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.deadletter__title {
  font-size: 16px;
  font-weight: 650;
  color: var(--ds-danger-fg);
}
.deadletter__lead {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--admin-ink);
}
body.dark-theme .search-index-page .deadletter__lead {
  color: #e7eaf0;
}
.deadletter__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 12px;
}
.deadletter__block h3 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 650;
  color: var(--admin-ink);
}
body.dark-theme .search-index-page .deadletter__block h3 {
  color: #ffffff;
}
.deadletter__block p,
.deadletter__block ul {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--admin-ink);
}
body.dark-theme .search-index-page .deadletter__block p,
body.dark-theme .search-index-page .deadletter__block ul {
  color: #e7eaf0;
}
.deadletter__block ul {
  padding-left: 18px;
}
.deadletter__block li + li {
  margin-top: 4px;
}
.deadletter__foot {
  margin: 12px 0 0;
  padding-top: 10px;
  border-top: 1px solid var(--ds-danger-line);
  font-size: 12px;
  line-height: 1.6;
  color: var(--ds-danger-fg);
}

/* ---- ③ 指标 ---- */
.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.card-head__title {
  font-size: 14px;
  font-weight: 650;
  /* 显式取色 —— 见上面 --ds-text-strong 的注释：继承 naive 的卡片标题色会在暗色下变成 1.11:1 */
  color: var(--ds-text-strong);
}
.micro {
  font-size: 11px;
  color: var(--ds-text-faint);
}
.metric-caption {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--ds-text-muted);
}
.metric-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
}
.metric-group {
  padding-right: 16px;
}
.metric-group + .metric-group {
  padding-left: 16px;
  padding-right: 0;
  border-left: 1px solid var(--ds-border);
}
.metric-group__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 10px;
}
.metric-group__title {
  font-size: 12px;
  font-weight: 650;
  color: var(--admin-ink);
}
body.dark-theme .search-index-page .metric-group__title {
  color: #ffffff;
}
.metric-group__sub {
  font-size: 11px;
  color: var(--ds-text-faint);
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}
.metric {
  padding: 12px;
  border: 1px solid var(--ds-border);
  border-radius: 10px;
  background: var(--admin-surface-muted);
}
.metric__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ds-text-muted);
}
.metric__dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--ds-idle-dot);
}
.metric.is-ok .metric__dot {
  background: var(--ds-ok-dot);
}
.metric.is-warn .metric__dot {
  background: var(--ds-warn-dot);
}
.metric.is-danger .metric__dot {
  background: var(--ds-danger-dot);
}
.metric__row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 6px;
}
/*
 * 数字是主角：32px / 650 / tabular-nums。
 * tabular-nums 不是装饰 —— 等宽数字让多个指标纵向对齐、刷新时不跳动。
 */
.metric__value {
  font-size: 32px;
  font-weight: 650;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--admin-ink);
}
body.dark-theme .search-index-page .metric__value {
  color: #ffffff;
}
.metric.is-danger .metric__value {
  color: var(--ds-danger-fg);
}
.metric__value.is-signal {
  color: var(--ds-warn-fg);
}
/* 解释常显，不藏 tooltip —— 运营不会去 hover。 */
.metric__hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ds-text-muted);
}

/* ---- 趋势 chip ---- */
.trend {
  margin-left: auto;
  padding: 1px 6px;
  border: 1px solid var(--ds-idle-line);
  border-radius: 999px;
  background: var(--ds-idle-bg);
  color: var(--ds-idle-fg);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.trend--up,
.trend--stalled {
  border-color: var(--ds-warn-line);
  background: var(--ds-warn-bg);
  color: var(--ds-warn-fg);
}
.trend--down {
  border-color: var(--ds-ok-line);
  background: var(--ds-ok-bg);
  color: var(--ds-ok-fg);
}

/* ---- ④ 操作 ---- */
.op-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.op-row__title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 650;
  color: var(--admin-ink);
}
body.dark-theme .search-index-page .op-row__title {
  color: #ffffff;
}
.op-row__desc {
  margin: 0;
  max-width: 60ch;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ds-text-muted);
}

/*
 * 重操作按钮：深墨 + 暖橙点缀。
 *
 * ⚠️ 刻意【不用】主色（那是普通操作），更【不用】红色（红是死信专属）。
 * 它表达的是「重」，既不是「错」也不是「状态」。
 * 用原生 button 而不是 n-button：naive 的主题会把颜色拉回主色系，
 * 与这套身份冲突（设计文档 §3.4 也把 heavy 定为自定义样式）。
 */
.btn-heavy {
  flex: none;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #172a48;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--admin-transition);
}
.btn-heavy:hover:not(:disabled) {
  background: #1e3557;
}
.btn-heavy:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-heavy__spark {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--admin-warm);
}
/*
 * 暗色下 #172a48 贴 #18181c 只有 ≈1.23:1，按钮会变成一块看不出边界的深斑。
 * 用 --admin-warm 描边（6.78:1）—— 与浅色态的 .btn-heavy__spark 同源，
 * 两个主题下是同一个橙；且它读起来是「按钮自己的点缀」而不是页面的「注意」色。
 * 不用状态色：状态色只用于状态。
 */
body.dark-theme .search-index-page .btn-heavy {
  background: #22314a;
  border-color: var(--admin-warm);
}
body.dark-theme .search-index-page .btn-heavy:hover:not(:disabled) {
  background: #2b3d5c;
}

.queued-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 12px 0 0;
  padding: 10px 12px;
  border: 1px solid var(--ds-warn-line);
  border-radius: 8px;
  background: var(--ds-warn-bg);
  color: var(--ds-warn-fg);
  font-size: 12px;
  line-height: 1.6;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0 16px;
}
.feedback {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.6;
}
.feedback.is-ok {
  color: var(--ds-ok-fg);
}
/* 表单校验失败用红 —— 它是通用交互约定，不是系统状态信号，不与「红=死信」冲突。 */
.feedback.is-err {
  color: var(--ds-danger-fg);
}
.muted {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ds-text-muted);
}

/* ---- ⑤⑥ 折叠区 ---- */
.legend {
  margin-top: 0;
}
.session-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.session-table th {
  padding: 8px 10px;
  border-bottom: 1px solid var(--ds-border);
  color: var(--ds-text-muted);
  font-size: 12px;
  font-weight: 600;
  text-align: left;
}
.session-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--ds-border);
  /* 同样不能靠继承：naive 的卡片内文字色不一定跟随主题（卡片标题就不跟随）。 */
  color: var(--ds-text-strong);
}
.session-table .num,
.session-table th.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.tnum {
  font-variant-numeric: tabular-nums;
}

/* 窄屏：两组纵向堆叠，分隔线从「竖」改「横」。 */
@media (max-width: 980px) {
  .metric-groups {
    grid-template-columns: minmax(0, 1fr);
  }
  .metric-group {
    padding-right: 0;
  }
  .metric-group + .metric-group {
    margin-top: 16px;
    padding-top: 16px;
    padding-left: 0;
    border-left: none;
    border-top: 1px solid var(--ds-border);
  }
  .deadletter__grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .op-row {
    flex-direction: column;
    align-items: stretch;
  }
  .btn-heavy {
    justify-content: center;
  }
}
</style>
