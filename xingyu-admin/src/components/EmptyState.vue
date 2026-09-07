<template>
  <section class="empty-state" aria-live="polite">
    <div class="empty-orbit" aria-hidden="true">
      <span class="orbit-dot orbit-dot--one"></span>
      <span class="orbit-dot orbit-dot--two"></span>
      <img class="empty-illustration" width="460" height="356" loading="lazy" decoding="async" :src="illustrationPath" :alt="''" />
    </div>
    <div class="empty-copy">
      <p class="empty-kicker">{{ routeLabel }}</p>
      <h2 v-if="title" class="empty-title">{{ title }}</h2>
      <p v-if="description" class="empty-desc">{{ description }}</p>
      <div v-if="$slots.action" class="empty-action">
        <slot name="action" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{
    title?: string
    description?: string
    /** 可指定业务插画；省略时按当前管理端路由自动选择 */
    illustration?: string
  }>()

const route = useRoute()
const routeIllustrations: Array<[string, string]> = [
  ['/community/users', '/images/admin-community-members.png'],
  ['/community/review', '/images/admin-review-governance.png'],
  ['/community/moderation', '/images/admin-review-governance.png'],
  ['/community/operations/groups', '/images/admin-community-stewardship.png'],
  ['/community/operations/galaxies', '/images/admin-community-stewardship.png'],
  ['/community/', '/images/notification-bell.png'],
  ['/system/', '/images/admin-system-observatory.png'],
  ['/monitor/', '/images/admin-monitor-observatory.png'],
  ['/log/', '/images/report-analytics-charts.png'],
  ['/message/', '/images/notification-bell.png'],
  ['/tool/', '/images/admin-system-observatory.png']
]

const illustrationPath = computed(() =>
  props.illustration
  ?? routeIllustrations.find(([prefix]) => route.path.startsWith(prefix))?.[1]
  ?? '/images/empty-state-guide.png'
)

const routeLabel = computed(() => {
  const labels: Array<[string, string]> = [
    ['/community/operations/galaxies', '星系内容库'],
    ['/community/operations/events', '活动运营'],
    ['/community/operations/guides', '社区指南'],
    ['/community/operations/announcements', '公告中心'],
    ['/community/operations/groups', '群聊治理'],
    ['/community/review', '内容审核'],
    ['/community/moderation', '社区治理'],
    ['/community/topics', '公共话题'],
    ['/system/', '平台配置'],
    ['/monitor/', '系统观测'],
    ['/log/', '审计记录']
  ]
  return labels.find(([prefix]) => route.path.startsWith(prefix))?.[1] ?? '星语运营台'
})
</script>

<style scoped lang="scss">
.empty-state {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 22px;
  width: min(100%, 620px);
  min-height: 252px;
  margin: auto;
  padding: 22px 28px;
  overflow: hidden;
  text-align: left;
  border: 1px solid #e2e7f0;
  border-radius: 18px;
  background:
    radial-gradient(circle at 18% 14%, rgb(198 211 255 / .52), transparent 34%),
    linear-gradient(135deg, #fbfcff 0%, #f5f7fc 100%);
  box-shadow: 0 14px 34px rgb(30 46 78 / .08);
}

.empty-orbit {
  position: relative;
  display: grid;
  flex: 0 0 230px;
  place-items: center;
  width: 230px;
  height: 178px;
  overflow: hidden;
  border: 1px solid rgb(116 126 180 / .2);
  border-radius: 15px;
  background: #17243f;

  &::before,
  &::after {
    position: absolute;
    content: '';
    border: 1px solid rgb(188 198 255 / .24);
    border-radius: 50%;
  }

  &::before { width: 180px; height: 72px; transform: rotate(-21deg); }
  &::after { width: 134px; height: 134px; transform: rotate(23deg); }
}

.empty-illustration {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: .88;
  mix-blend-mode: screen;
}

.orbit-dot {
  position: absolute;
  z-index: 2;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #e2bc70;
  box-shadow: 0 0 14px #e2bc70;
}

.orbit-dot--one { top: 34px; right: 45px; }
.orbit-dot--two { bottom: 28px; left: 44px; background: #c6ccff; box-shadow: 0 0 14px #c6ccff; }

.empty-copy { min-width: 0; }

.empty-kicker {
  margin: 0 0 8px;
  color: #6c6aaf;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .12em;
}

.empty-title {
  margin: 0 0 8px;
  font-size: 19px;
  font-weight: 700;
  color: #1f3152;
}

.empty-desc {
  margin: 0;
  font-size: 13px;
  color: #758199;
  max-width: 280px;
  line-height: 1.6;
}

.empty-action {
  margin-top: 12px;
}

// 暗色模式适配
:global(body.dark-theme) {
  .empty-state { border-color: #35425a; background: linear-gradient(135deg, #172238, #111a2a); box-shadow: none; }
  .empty-title { color: #eef3fb; }
  .empty-desc { color: #aebbd0; }
}

@media (max-width: 620px) {
  .empty-state { flex-direction: column; min-height: 0; text-align: center; }
  .empty-copy { display: grid; justify-items: center; }
}
</style>
