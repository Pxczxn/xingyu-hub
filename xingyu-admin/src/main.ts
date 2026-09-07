import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import naive from 'naive-ui'
import App from './App.vue'
import router from './router'
import './styles/index.scss'
import { initCryptoRuntime } from './utils/request'
import { useSiteStore } from './stores/site'

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(pinia)
app.use(router)
app.use(naive)

// 先挂载页面，配置和加密会话在后台初始化；请求拦截器会为首批接口补齐会话。
app.mount('#app')

void initCryptoRuntime().finally(() => {
  const siteStore = useSiteStore()
  void siteStore.loadConfig().then(() => {
    if (siteStore.disableDevtool) {
      void import('disable-devtool').then((DisableDevtool) => {
        DisableDevtool.default()
      })
    }
  })
})
