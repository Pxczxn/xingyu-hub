<template>
  <div class="login-page" :class="[`style-${currentStyle}`]">
    <!-- 样式一：左右分栏式 -->
    <template v-if="currentStyle === 2">
      <main class="login-container style1-container style2-container admin-auth-panel">
        <div class="login-banner" :style="{ background: `linear-gradient(135deg, rgba(8, 22, 53, 0.8) 0%, rgba(17, 39, 88, 0.42) 100%), url('/images/auth-constellation.png') center/cover no-repeat` }">
          <div class="banner-content">
            <div class="banner-logo">
              <div class="logo-icon">星</div>
              <span class="logo-text">星语社区</span>
            </div>
            <p class="admin-auth-kicker">COMMUNITY OPERATIONS</p>
            <h1 class="banner-title">让每一次守护，<br />都更有方向。</h1>
            <p class="banner-desc">内容运营、审核治理与关键配置，在一处保持社区的秩序与温度。</p>
            <div class="banner-features admin-auth-features">
              <div class="feature-item">
                <div class="feature-dot"></div>
                <span>社区内容运营</span>
              </div>
              <div class="feature-item">
                <div class="feature-dot"></div>
                <span>审核与治理工作台</span>
              </div>
              <div class="feature-item">
                <div class="feature-dot"></div>
                <span>系统配置与安全</span>
              </div>
            </div>
          </div>
          <div class="banner-decoration">
            <div class="decoration-circle circle-1"></div>
            <div class="decoration-circle circle-2"></div>
            <div class="decoration-circle circle-3"></div>
          </div>
        </div>
        <div class="login-form-wrapper">
          <div class="login-form">
            <p class="admin-form-kicker">运营工作台</p>
            <h2 class="form-title">欢迎回来</h2>
            <p class="form-subtitle">使用管理员账号，进入星语社区运营台。</p>
            <n-form ref="formRef" :model="formData" :rules="rules" size="large">
              <n-form-item path="username" label="用户名">
                <n-input v-model:value="formData.username" placeholder="请输入用户名" :maxlength="50" @keyup.enter="handleLogin">
                  <template #prefix><n-icon :component="PersonOutline" /></template>
                </n-input>
              </n-form-item>
              <n-form-item path="password" label="密码">
                <n-input v-model:value="formData.password" type="password" placeholder="请输入密码" show-password-on="click" :maxlength="50" @keyup.enter="handleLogin">
                  <template #prefix><n-icon :component="LockClosedOutline" /></template>
                </n-input>
              </n-form-item>
              <!-- 图片验证码 -->
              <n-form-item v-if="captchaEnabled && captchaType === 'image'" path="code" label="验证码">
                <div class="captcha-row">
                  <n-input v-model:value="formData.code" placeholder="请输入验证码" :maxlength="6" @keyup.enter="handleLogin" />
                  <img v-if="captchaImg" :src="captchaImg" class="captcha-img" @click="loadCaptcha" title="点击刷新" />
                  <n-spin v-else :size="20" />
                </div>
              </n-form-item>
              <!-- 短信验证码 -->
              <template v-if="captchaEnabled && captchaType === 'sms'">
                <n-form-item label="手机号">
                  <n-input v-model:value="smsPhone" placeholder="请输入手机号" :maxlength="11" />
                </n-form-item>
                <n-form-item path="code" label="验证码">
                  <div class="sms-row">
                    <n-input v-model:value="formData.code" placeholder="请输入验证码" :maxlength="6" @keyup.enter="handleLogin" />
                    <n-button :disabled="smsCountdown > 0" :loading="smsSending" @click="sendSmsCode">
                      {{ smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码' }}
                    </n-button>
                  </div>
                </n-form-item>
              </template>
              <n-form-item v-if="rememberMeEnabled" :show-label="false">
                <div class="login-options">
                  <n-checkbox v-model:checked="formData.rememberMe">记住我</n-checkbox>
                </div>
              </n-form-item>
              <n-form-item>
                <n-button type="primary" block :loading="loading" @click="handleLogin">登 录</n-button>
              </n-form-item>
            </n-form>
            <p class="admin-login-note">仅限已授权的运营人员访问</p>
          </div>
        </div>
      </main>
    </template>

    <!-- 样式二：全屏背景（与样式一相同布局，加背景） -->
    <template v-else-if="currentStyle === 1">
      <div class="style2-bg"></div>
      <div class="login-container style1-container">
        <div class="login-banner" :style="{ background: `linear-gradient(135deg, ${themeStore.primaryColor} 0%, ${adjustColor(themeStore.primaryColor, -30)} 100%)` }">
          <div class="banner-content">
            <div class="banner-logo">
              <img v-if="siteLogo" :src="siteLogo" class="logo-img" alt="Logo" />
              <div v-else class="logo-icon">{{ siteName.charAt(0) }}</div>
              <span class="logo-text">{{ siteName }}</span>
            </div>
            <h1 class="banner-title">{{ siteDescription || '后台管理系统' }}</h1>
            <p class="banner-desc">打造一款现代化后台管理平台</p>
            <div class="banner-features">
              <div class="feature-item">
                <div class="feature-dot"></div>
                <span>RBAC权限管理</span>
              </div>
              <div class="feature-item">
                <div class="feature-dot"></div>
                <span>高效开发体验</span>
              </div>
              <div class="feature-item">
                <div class="feature-dot"></div>
                <span>精美界面设计</span>
              </div>
            </div>
          </div>
          <div class="banner-decoration">
            <div class="decoration-circle circle-1"></div>
            <div class="decoration-circle circle-2"></div>
            <div class="decoration-circle circle-3"></div>
          </div>
        </div>
        <div class="login-form-wrapper">
          <div class="login-form">
            <h2 class="form-title">欢迎回来</h2>
            <p class="form-subtitle">请输入您的账号信息登录系统</p>
            <n-form ref="formRef" :model="formData" :rules="rules" size="large">
              <n-form-item path="username" label="用户名">
                <n-input v-model:value="formData.username" placeholder="请输入用户名" :maxlength="50" @keyup.enter="handleLogin">
                  <template #prefix><n-icon :component="PersonOutline" /></template>
                </n-input>
              </n-form-item>
              <n-form-item path="password" label="密码">
                <n-input v-model:value="formData.password" type="password" placeholder="请输入密码" show-password-on="click" :maxlength="50" @keyup.enter="handleLogin">
                  <template #prefix><n-icon :component="LockClosedOutline" /></template>
                </n-input>
              </n-form-item>
              <!-- 图片验证码 -->
              <n-form-item v-if="captchaEnabled && captchaType === 'image'" path="code" label="验证码">
                <div class="captcha-row">
                  <n-input v-model:value="formData.code" placeholder="请输入验证码" :maxlength="6" @keyup.enter="handleLogin" />
                  <img v-if="captchaImg" :src="captchaImg" class="captcha-img" @click="loadCaptcha" title="点击刷新" />
                  <n-spin v-else :size="20" />
                </div>
              </n-form-item>
              <!-- 短信验证码 -->
              <template v-if="captchaEnabled && captchaType === 'sms'">
                <n-form-item label="手机号">
                  <n-input v-model:value="smsPhone" placeholder="请输入手机号" :maxlength="11" />
                </n-form-item>
                <n-form-item path="code" label="验证码">
                  <div class="sms-row">
                    <n-input v-model:value="formData.code" placeholder="请输入验证码" :maxlength="6" @keyup.enter="handleLogin" />
                    <n-button :disabled="smsCountdown > 0" :loading="smsSending" @click="sendSmsCode">
                      {{ smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码' }}
                    </n-button>
                  </div>
                </n-form-item>
              </template>
              <n-form-item v-if="rememberMeEnabled" :show-label="false">
                <div class="login-options">
                  <n-checkbox v-model:checked="formData.rememberMe">记住我</n-checkbox>
                </div>
              </n-form-item>
              <n-form-item>
                <n-button type="primary" block :loading="loading" @click="handleLogin">登 录</n-button>
              </n-form-item>
            </n-form>
          </div>
        </div>
      </div>
      <div class="style2-footer">
        <span>{{ copyright }}</span>
      </div>
    </template>

    <!-- 样式三：毛玻璃（与样式一相同布局，加毛玻璃效果） -->
    <template v-else-if="currentStyle === 3">
      <div class="style3-bg" :style="{ background: `linear-gradient(135deg, ${themeStore.primaryColor} 0%, ${adjustColor(themeStore.primaryColor, -30)} 50%, ${themeStore.primaryColor} 100%)` }"></div>
      <div class="login-container style1-container style3-glass">
        <div class="login-banner" style="background: transparent;">
          <div class="banner-content">
            <div class="banner-logo">
              <img v-if="siteLogo" :src="siteLogo" class="logo-img" alt="Logo" />
              <div v-else class="logo-icon" style="background: rgba(255, 255, 255, 0.15); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2);">{{ siteName.charAt(0) }}</div>
              <span class="logo-text">{{ siteName }}</span>
            </div>
            <h1 class="banner-title" style="color: #fff;">{{ siteDescription || '后台管理系统' }}</h1>
            <p class="banner-desc">打造一款现代化后台管理平台</p>
            <div class="banner-features">
              <div class="feature-item">
                <div class="feature-dot" style="background: rgba(255, 255, 255, 0.6);"></div>
                <span>RBAC权限管理</span>
              </div>
              <div class="feature-item">
                <div class="feature-dot" style="background: rgba(255, 255, 255, 0.6);"></div>
                <span>高效开发体验</span>
              </div>
              <div class="feature-item">
                <div class="feature-dot" style="background: rgba(255, 255, 255, 0.6);"></div>
                <span>精美界面设计</span>
              </div>
            </div>
          </div>
          <div class="banner-decoration">
            <div class="decoration-circle circle-1"></div>
            <div class="decoration-circle circle-2"></div>
            <div class="decoration-circle circle-3"></div>
          </div>
        </div>
        <div class="login-form-wrapper style3-form-glass">
          <div class="login-form">
            <h2 class="form-title">欢迎回来</h2>
            <p class="form-subtitle">请输入您的账号信息登录系统</p>
            <n-form ref="formRef" :model="formData" :rules="rules" size="large">
              <n-form-item path="username" label="用户名">
                <n-input v-model:value="formData.username" placeholder="请输入用户名" :maxlength="50" @keyup.enter="handleLogin">
                  <template #prefix><n-icon :component="PersonOutline" /></template>
                </n-input>
              </n-form-item>
              <n-form-item path="password" label="密码">
                <n-input v-model:value="formData.password" type="password" placeholder="请输入密码" show-password-on="click" :maxlength="50" @keyup.enter="handleLogin">
                  <template #prefix><n-icon :component="LockClosedOutline" /></template>
                </n-input>
              </n-form-item>
              <!-- 图片验证码 -->
              <n-form-item v-if="captchaEnabled && captchaType === 'image'" path="code" label="验证码">
                <div class="captcha-row">
                  <n-input v-model:value="formData.code" placeholder="请输入验证码" :maxlength="6" @keyup.enter="handleLogin" />
                  <img v-if="captchaImg" :src="captchaImg" class="captcha-img" @click="loadCaptcha" title="点击刷新" />
                  <n-spin v-else :size="20" />
                </div>
              </n-form-item>
              <!-- 短信验证码 -->
              <template v-if="captchaEnabled && captchaType === 'sms'">
                <n-form-item label="手机号">
                  <n-input v-model:value="smsPhone" placeholder="请输入手机号" :maxlength="11" />
                </n-form-item>
                <n-form-item path="code" label="验证码">
                  <div class="sms-row">
                    <n-input v-model:value="formData.code" placeholder="请输入验证码" :maxlength="6" @keyup.enter="handleLogin" />
                    <n-button :disabled="smsCountdown > 0" :loading="smsSending" @click="sendSmsCode">
                      {{ smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码' }}
                    </n-button>
                  </div>
                </n-form-item>
              </template>
              <n-form-item v-if="rememberMeEnabled" :show-label="false">
                <div class="login-options">
                  <n-checkbox v-model:checked="formData.rememberMe">记住我</n-checkbox>
                </div>
              </n-form-item>
              <n-form-item>
                <n-button type="primary" block :loading="loading" @click="handleLogin">登 录</n-button>
              </n-form-item>
            </n-form>
          </div>
        </div>
      </div>
      <div class="style3-footer">
        <span>{{ copyright }}</span>
      </div>
    </template>


    <!-- 滑块验证弹窗 -->
    <n-modal v-model:show="showSliderModal" :mask-closable="false" class="slider-modal">
      <div class="slider-puzzle-container">
        <div class="slider-puzzle-header">
          <span>请完成下列验证后继续:</span>
          <n-button text @click="closeSliderModal">
            <n-icon size="20"><CloseOutline /></n-icon>
          </n-button>
        </div>
        <div
          class="slider-puzzle-image"
          @mousemove="onSliderDragMove"
          @mouseup="onSliderDragEnd"
          @mouseleave="onSliderDragEnd"
          @touchmove="onSliderDragMove"
          @touchend="onSliderDragEnd"
        >
          <!-- 背景图片 -->
          <div class="puzzle-bg" :class="`puzzle-bg-${puzzleImageIndex}`"></div>
          <!-- 缺口位置 -->
          <div class="puzzle-slot" :style="{ left: sliderTargetX + 'px' }"></div>
          <!-- 拼图块 -->
          <div
            class="puzzle-piece"
            :class="{ verified: sliderVerified }"
            :style="{ left: sliderPuzzleX + 'px' }"
          >
            <div class="puzzle-piece-bg" :class="`puzzle-bg-${puzzleImageIndex}`" :style="{ backgroundPositionX: -sliderTargetX + 'px' }"></div>
          </div>
        </div>
        <div class="slider-puzzle-track">
          <div class="slider-track-bg">
            <div class="slider-track-progress" :style="{ width: sliderPuzzleX + 'px' }"></div>
          </div>
          <div
            class="slider-handle"
            :class="{ dragging: sliderDragging, verified: sliderVerified }"
            :style="{ left: sliderPuzzleX + 'px' }"
            @mousedown="onSliderDragStart"
            @touchstart="onSliderDragStart"
          >
            <n-icon v-if="!sliderVerified" size="18"><ArrowForwardOutline /></n-icon>
            <n-icon v-else size="18"><CheckmarkOutline /></n-icon>
          </div>
          <span class="slider-track-tip" v-if="sliderPuzzleX === 0">按住左边按钮拖动完成上方拼图</span>
        </div>
        <div class="slider-puzzle-footer">
          <n-button text size="small" @click="initSliderPuzzle">
            <n-icon><RefreshOutline /></n-icon>
            <span>换一张</span>
          </n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMessage, type FormInst, type FormRules } from 'naive-ui'
import { PersonOutline, LockClosedOutline, RefreshOutline, CloseOutline, ArrowForwardOutline, CheckmarkOutline } from '@vicons/ionicons5'
import { useUserStore } from '@/stores/user'
import { useSiteStore } from '@/stores/site'
import { useThemeStore } from '@/stores/theme'
import { authApi } from '@/api/auth'
import { configGroupApi } from '@/api/org'

const router = useRouter()
const route = useRoute()
const message = useMessage()
const userStore = useUserStore()
const siteStore = useSiteStore()
const themeStore = useThemeStore()

// 站点配置（带默认值）
const siteName = computed(() => siteStore.siteName || '星语社区 · 运营台')
const siteDescription = computed(() => siteStore.siteDescription || '社区运营与系统配置入口')
const siteLogo = computed(() => siteStore.siteLogo)
const copyright = computed(() => siteStore.copyright || '星语社区 · 运营台')

// 登录配置
const captchaEnabled = ref(false)
const captchaType = ref('image') // image, slider, sms
const rememberMeEnabled = ref(true)

// 验证码
const captchaImg = ref('')
const captchaUuid = ref('')
const captchaLoading = ref(false)

// 滑块验证码弹窗
const showSliderModal = ref(false)
const sliderPuzzleX = ref(0) // 拼图块当前位置
const sliderTargetX = ref(0) // 目标位置
const sliderDragging = ref(false)
const sliderVerified = ref(false)
const sliderStartX = ref(0)
const puzzleImageIndex = ref(0) // 使用的背景图片索引

// 短信验证码
const smsPhone = ref('')
const smsSending = ref(false)
const smsCountdown = ref(0)

// 加载配置
async function loadPublicConfig() {
  try {
    const config = await configGroupApi.getPublicConfig()
    captchaEnabled.value = config.login?.captchaEnabled || false
    captchaType.value = config.login?.captchaType || 'image'
    rememberMeEnabled.value = config.login?.rememberMe !== false

    // 如果启用图片验证码，加载验证码
    if (captchaEnabled.value && captchaType.value === 'image') {
      await loadCaptcha()
    }
  } catch (error) {
    console.error('加载配置失败', error)
  }
}

// 加载图片验证码
async function loadCaptcha() {
  captchaLoading.value = true
  try {
    const result = await authApi.getCaptcha()
    captchaImg.value = result.img
    captchaUuid.value = result.uuid
  } catch (error) {
    console.error('获取验证码失败', error)
  } finally {
    captchaLoading.value = false
  }
}

// 初始化滑块验证码
function initSliderPuzzle() {
  sliderPuzzleX.value = 0
  sliderVerified.value = false
  // 目标位置在 150-250 之间随机
  sliderTargetX.value = 150 + Math.floor(Math.random() * 100)
  // 随机选择一张背景图
  puzzleImageIndex.value = Math.floor(Math.random() * 3)
}

// 打开滑块验证弹窗
function openSliderModal() {
  initSliderPuzzle()
  showSliderModal.value = true
}

// 关闭滑块验证弹窗
function closeSliderModal() {
  showSliderModal.value = false
  sliderPuzzleX.value = 0
}

// 滑块拖动开始
function onSliderDragStart(e: MouseEvent | TouchEvent) {
  if (sliderVerified.value) return
  sliderDragging.value = true
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  sliderStartX.value = clientX - sliderPuzzleX.value
}

// 滑块拖动中
function onSliderDragMove(e: MouseEvent | TouchEvent) {
  if (!sliderDragging.value || sliderVerified.value) return
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  let newX = clientX - sliderStartX.value
  // 限制范围 0-280
  newX = Math.max(0, Math.min(280, newX))
  sliderPuzzleX.value = newX
}

// 滑块拖动结束
function onSliderDragEnd() {
  if (!sliderDragging.value || sliderVerified.value) return
  sliderDragging.value = false

  // 检查是否在目标位置附近（误差 5px）
  if (Math.abs(sliderPuzzleX.value - sliderTargetX.value) < 8) {
    sliderVerified.value = true
    sliderPuzzleX.value = sliderTargetX.value // 对齐
    message.success('验证成功')

    // 延迟关闭弹窗并执行登录
    setTimeout(() => {
      closeSliderModal()
      doLogin()
    }, 500)
  } else {
    // 验证失败，重置
    message.warning('验证失败，请重试')
    setTimeout(() => {
      sliderPuzzleX.value = 0
    }, 300)
  }
}

// 发送短信验证码
async function sendSmsCode() {
  if (!smsPhone.value || !/^1[3-9]\d{9}$/.test(smsPhone.value)) {
    message.warning('请输入正确的手机号')
    return
  }

  smsSending.value = true
  try {
    await authApi.sendSmsCode(smsPhone.value)
    message.success('验证码已发送，请查看控制台')

    // 开始倒计时
    smsCountdown.value = 60
    const timer = setInterval(() => {
      smsCountdown.value--
      if (smsCountdown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)
  } catch (error: any) {
    message.error(error.message || '发送失败')
  } finally {
    smsSending.value = false
  }
}

// 加载站点配置
onMounted(() => {
  if (!siteStore.loaded) {
    siteStore.loadConfig()
  }
  loadPublicConfig()
})

// 样式选项
const currentStyle = ref(2)

const formRef = ref<FormInst | null>(null)
const loading = ref(false)

const formData = reactive({
  username: '',
  password: '',
  code: '',
  rememberMe: true
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  code: [{ required: true, message: '请输入验证码', trigger: 'blur' }]
}

async function handleLogin() {
  try {
    // 短信验证码校验
    if (captchaEnabled.value && captchaType.value === 'sms' && !smsPhone.value) {
      message.warning('请输入手机号')
      return
    }

    await formRef.value?.validate()

    // 如果是滑块验证码，先弹出验证弹窗
    if (captchaEnabled.value && captchaType.value === 'slider') {
      openSliderModal()
      return
    }

    // 其他类型直接登录
    await doLogin()
  } catch (error: any) {
    // 表单验证失败
  }
}

// 执行实际登录
async function doLogin() {
  loading.value = true
  try {
    const loginData: any = {
      username: formData.username,
      password: formData.password
    }

    // 根据验证码类型传递不同参数
    if (captchaEnabled.value) {
      if (captchaType.value === 'image') {
        loginData.uuid = captchaUuid.value
        loginData.code = formData.code
      } else if (captchaType.value === 'slider') {
        loginData.code = 'slider_verified'
      } else if (captchaType.value === 'sms') {
        loginData.phone = smsPhone.value
        loginData.code = formData.code
      }
    }

    // 如果启用记住我
    if (rememberMeEnabled.value) {
      loginData.rememberMe = formData.rememberMe
    }

    await userStore.login(loginData)
    message.success('登录成功')
    const redirect = route.query.redirect as string
    router.push(redirect || '/')
  } catch (error: any) {
    // 刷新验证码
    if (captchaEnabled.value && captchaType.value === 'image') {
      loadCaptcha()
    } else if (captchaEnabled.value && captchaType.value === 'slider') {
      sliderVerified.value = false
    }
  } finally {
    loading.value = false
  }
}

// 颜色调整函数（调深或调亮）
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + percent))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent))
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent))
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}
</script>

<style lang="scss" scoped>
/* ==================== 公共样式 ==================== */
.login-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;
}

.style-switcher {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 8px;
  z-index: 100;
  background: rgba(255, 255, 255, 0.9);
  padding: 8px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}

.style-option {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: #666;

  &:hover {
    background: #f0f0f0;
    color: #333;
  }

  &.active {
    background: #111827;
    color: #fff;
  }
}

:deep(.n-form-item) {
  margin-bottom: 18px;
}

:deep(.n-form-item-label) {
  font-weight: 500;
}

:deep(.n-input) {
  --n-height: 40px;
  --n-border-radius: 8px;
}

:deep(.n-button) {
  --n-height: 40px;
  --n-border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
}

/* ==================== 样式一：左右分栏式 ==================== */
.style-1 {
  background: linear-gradient(135deg, #F9FAFB 0%, #E5E7EB 100%);
  padding: 20px;
}

.style1-container {
  display: flex;
  width: 100%;
  max-width: 1000px;
  min-height: 600px;
  background: #FFFFFF;
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.login-banner {
  flex: 1;
  background: linear-gradient(135deg, #111827 0%, #1F2937 100%);
  padding: 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.banner-content {
  position: relative;
  z-index: 1;
}

.banner-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;

  .logo-icon {
    width: 48px;
    height: 48px;
    background: #FFFFFF;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--primary-color, #111827);
    font-size: 24px;
    font-weight: 700;
  }

  .logo-img {
    width: 48px;
    height: 48px;
    object-fit: contain;
    border-radius: 12px;
  }

  .logo-img-small {
    width: 52px;
    height: 52px;
    object-fit: contain;
    border-radius: 14px;
  }

  .brand-logo-img {
    width: 56px;
    height: 56px;
    object-fit: contain;
    border-radius: 14px;
  }

  .logo-text {
    font-size: 24px;
    font-weight: 700;
    color: #FFFFFF;
  }
}

.banner-title {
  font-size: 36px;
  font-weight: 700;
  color: #FFFFFF;
  margin-bottom: 16px;
}

.banner-desc {
  font-size: 16px;
  color: #d9dbdd;
  margin-bottom: 40px;
}

.banner-features {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  color: #D1D5DB;

  .feature-icon {
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  .feature-dot {
    width: 6px;
    height: 6px;
    background: currentColor;
    border-radius: 50%;
    flex-shrink: 0;
    opacity: 0.6;
  }
}

.banner-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.decoration-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.03);

  &.circle-1 { width: 400px; height: 400px; top: -100px; right: -100px; }
  &.circle-2 { width: 300px; height: 300px; bottom: -50px; left: -50px; }
  &.circle-3 { width: 200px; height: 200px; top: 50%; left: 50%; transform: translate(-50%, -50%); }
}

.login-form-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.login-form {
  width: 100%;
  max-width: 320px;
}

.form-title {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 6px;
}

.form-subtitle {
  font-size: 14px;
  color: #6B7280;
  margin-bottom: 24px;
}

/* 验证码 */
.captcha-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;

  .n-input {
    flex: 1;
  }

  &.dark .captcha-img {
    border-color: rgba(255, 255, 255, 0.2);
  }
}

.captcha-img {
  height: 40px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid #E5E7EB;

  &:hover {
    opacity: 0.8;
  }
}

/* 登录选项 */
.login-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  &.dark {
    .register-link {
      color: rgba(255, 255, 255, 0.7);

      &:hover {
        color: #fff;
      }
    }
  }
}

.register-link {
  color: #111827;
  font-size: 14px;
  cursor: pointer;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

/* 滑块验证弹窗 */
.slider-puzzle-container {
  width: 380px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.slider-puzzle-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  font-size: 15px;
  color: #1f2937;
  border-bottom: 1px solid #f0f0f0;
}

.slider-puzzle-image {
  position: relative;
  width: 100%;
  height: 200px;
  overflow: hidden;
  user-select: none;
}

.puzzle-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;

  &.puzzle-bg-0 {
    background-image: url('https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&h=200&fit=crop');
  }

  &.puzzle-bg-1 {
    background-image: url('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=200&fit=crop');
  }

  &.puzzle-bg-2 {
    background-image: url('https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=200&fit=crop');
  }
}

.puzzle-slot {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 50px;
  height: 50px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.3);

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: -8px;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 50%;
  }
}

.puzzle-piece {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 50px;
  height: 50px;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  transition: box-shadow 0.2s;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: -8px;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    background: inherit;
    border-radius: 50%;
    overflow: hidden;
  }

  &.verified {
    box-shadow: 0 0 0 3px #22c55e, 0 2px 10px rgba(0, 0, 0, 0.3);
  }
}

.puzzle-piece-bg {
  width: 380px;
  height: 200px;
  background-size: cover;
  background-position: center;
  position: absolute;
  top: -75px;
  left: 0;

  &.puzzle-bg-0 {
    background-image: url('https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&h=200&fit=crop');
  }

  &.puzzle-bg-1 {
    background-image: url('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=200&fit=crop');
  }

  &.puzzle-bg-2 {
    background-image: url('https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=200&fit=crop');
  }
}

.slider-puzzle-track {
  position: relative;
  height: 50px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  background: #f5f7fa;
}

.slider-track-bg {
  position: absolute;
  left: 20px;
  right: 20px;
  height: 36px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.slider-track-progress {
  height: 100%;
  background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
  transition: width 0.05s linear;
}

.slider-handle {
  position: absolute;
  left: 20px;
  width: 50px;
  height: 36px;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  z-index: 1;
  transition: background 0.2s, box-shadow 0.2s;
  color: #6b7280;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &.dragging {
    cursor: grabbing;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  }

  &.verified {
    background: #22c55e;
    color: #fff;
  }
}

.slider-track-tip {
  position: absolute;
  left: 80px;
  right: 20px;
  text-align: center;
  font-size: 13px;
  color: #9ca3af;
  pointer-events: none;
}

.slider-puzzle-footer {
  padding: 12px 20px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-start;

  .n-button {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #6b7280;

    &:hover {
      color: #111827;
    }
  }
}

/* 短信验证码 */
.sms-row {
  display: flex;
  gap: 12px;
  width: 100%;

  .n-input {
    flex: 1;
  }

  .n-button {
    flex-shrink: 0;
    width: 120px;
  }
}

/* ==================== 样式二：全屏背景 ==================== */
.style-2 {
  background:
    radial-gradient(circle at 14% 82%, rgba(244, 181, 126, 0.13), transparent 28%),
    radial-gradient(circle at 86% 10%, rgba(124, 148, 214, 0.18), transparent 30%),
    #f5f3ef;
}

.style2-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.style2-container {
  max-width: 1180px !important;
  min-height: min(700px, calc(100dvh - 40px)) !important;
  position: relative;
  z-index: 2;
}

/* 样式二全屏左右比例调整 */
.style2-container .login-banner {
  flex: 1.2;
  border-radius: 0;
}

.style2-container .login-form-wrapper {
  flex: 0.8;
  border-radius: 0;
  background: #ffffff;
  // 验证码开启时仍须在常见笔记本首屏内完整容纳表单。
  padding-block: 8px;
}

/* 星语运营台：与社区端认证页一致的克制、夜航感双栏视觉。 */
.admin-auth-panel {
  border: 1px solid rgba(26, 45, 81, 0.08);
  box-shadow: 0 28px 80px rgba(22, 35, 65, 0.16);
}

.admin-auth-panel .login-banner {
  padding: 48px 56px;
}

.admin-auth-panel .banner-logo {
  margin-bottom: 34px;
}

.admin-auth-panel .logo-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  color: #172d59;
  font-size: 20px;
}

.admin-auth-panel .logo-text {
  font-size: 20px;
  letter-spacing: 0.02em;
}

.admin-auth-kicker,
.admin-form-kicker {
  margin: 0 0 10px;
  color: #f6c58f;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.admin-auth-panel .banner-title {
  font-size: clamp(30px, 2.6vw, 42px);
  line-height: 1.18;
  letter-spacing: -0.035em;
  margin-bottom: 16px;
}

.admin-auth-panel .banner-desc {
  max-width: 420px;
  margin-bottom: 28px;
  color: rgba(240, 245, 255, 0.76);
  line-height: 1.75;
}

.admin-auth-features {
  gap: 12px;
}

.admin-auth-features .feature-item {
  color: rgba(244, 247, 255, 0.78);
  font-size: 14px;
}

.admin-auth-features .feature-dot {
  width: 7px;
  height: 7px;
  color: #f6c58f;
  opacity: 1;
}

.admin-auth-panel .login-form-wrapper {
  padding: 8px 52px;
}

.admin-auth-panel .login-form {
  max-width: 350px;
}

.admin-auth-panel .form-title {
  margin: 0 0 7px;
  font-size: 28px;
  letter-spacing: -0.03em;
  color: #182b52;
}

.admin-auth-panel .form-subtitle {
  margin: 0 0 14px;
  color: #71809a;
}

.admin-auth-panel :deep(.n-form-item) {
  margin-bottom: 8px;
}

.admin-auth-panel :deep(.n-form-item-label) {
  color: #33466b;
  font-size: 13px;
}

.admin-auth-panel :deep(.n-input) {
  --n-height: 42px;
  --n-border-radius: 12px;
}

.admin-auth-panel :deep(.n-button) {
  --n-height: 42px;
  --n-border-radius: 12px;
  background: #243e73;
  box-shadow: 0 10px 20px rgba(36, 62, 115, 0.18);
}

.admin-login-note {
  margin: 4px 0 0;
  color: #9ba7ba;
  font-size: 12px;
  text-align: center;
}

/* 小屏幕保持全屏堆叠 */
@media (max-width: 960px) {
  .login-page {
    align-items: flex-start;
    padding: 16px;
  }

  .style2-container {
    flex-direction: column;
    min-height: auto !important;
    overflow-y: auto;
  }

  .style2-container .login-banner {
    flex: none;
    min-height: 300px;
    padding: 40px 24px;
  }

  .style2-container .login-form-wrapper {
    flex: 1;
    padding: 40px 24px;
  }

  .admin-auth-panel .login-banner {
    padding: 36px 28px;
  }

  .admin-auth-panel .login-form-wrapper {
    padding: 32px 24px;
  }
}

.style2-footer {
  position: absolute;
  bottom: 24px;
  left: 0;
  right: 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  z-index: 1;
}

.style1-footer {
  position: absolute;
  bottom: 24px;
  left: 0;
  right: 0;
  text-align: center;
  color: #6B7280;
  font-size: 13px;
}

.style3-footer {
  position: absolute;
  bottom: 24px;
  left: 0;
  right: 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  z-index: 1;
}

/* ==================== 样式三：毛玻璃 ==================== */
.style-3 {
  background: linear-gradient(135deg, #111827 0%, #1F2937 50%, #111827 100%);
}

.style3-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(ellipse at 20% 30%, rgba(255, 255, 255, 0.05) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(255, 255, 255, 0.03) 0%, transparent 50%);
}

/* 样式三的毛玻璃效果 */
.style3-glass {
  background: rgba(255, 255, 255, 0.08) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 80px -20px rgba(0, 0, 0, 0.5);

  .login-banner {
    background: transparent;

    .banner-logo .logo-icon {
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .banner-logo .logo-text,
    .banner-title {
      color: #fff;
    }

    .banner-desc {
      color: rgba(255, 255, 255, 0.7);
    }

    .banner-features .feature-item {
      color: rgba(255, 255, 255, 0.8);
    }

    .banner-features .feature-dot {
      width: 6px;
      height: 6px;
      background: rgba(255, 255, 255, 0.6);
      border-radius: 50%;
      flex-shrink: 0;
    }

    .decoration-circle {
      border-color: rgba(255, 255, 255, 0.08);
    }
  }

  .login-form-wrapper {
    background: transparent;
  }
}

/* 样式三表单毛玻璃效果 */
.style3-form-glass {
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(16px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);

  .login-form {
    .form-title {
      color: #fff;
    }

    .form-subtitle {
      color: rgba(255, 255, 255, 0.6);
    }
  }

  :deep(.n-form-item-label) {
    color: rgba(255, 255, 255, 0.8) !important;
  }

  :deep(.n-input) {
    --n-color: rgba(255, 255, 255, 0.08);
    --n-color-focus: rgba(255, 255, 255, 0.12);
    --n-border: 1px solid rgba(255, 255, 255, 0.15);
    --n-border-hover: 1px solid rgba(255, 255, 255, 0.25);
    --n-border-focus: 1px solid rgba(255, 255, 255, 0.3);
    --n-text-color: #fff;
    --n-placeholder-color: rgba(255, 255, 255, 0.4);
    --n-caret-color: #fff;

    .n-input__prefix {
      color: rgba(255, 255, 255, 0.5);
    }

    .n-input__eye {
      color: rgba(255, 255, 255, 0.5);

      &:hover {
        color: rgba(255, 255, 255, 0.8);
      }
    }
  }

  :deep(.n-checkbox) {
    --n-text-color: rgba(255, 255, 255, 0.8);
  }

  .login-options .register-link {
    color: rgba(255, 255, 255, 0.6);

    &:hover {
      color: #fff;
    }
  }

  .captcha-img {
    border: 1px solid rgba(255, 255, 255, 0.15);
  }
}

/* ==================== 响应式 ==================== */
@media (max-width: 768px) {
  .style1-container {
    flex-direction: column;
    max-width: 400px;
  }

  .login-banner {
    padding: 32px;
  }

  .banner-title {
    font-size: 24px;
  }

  .banner-features {
    display: none;
  }

  .login-form-wrapper {
    padding: 32px;
  }
}

</style>
