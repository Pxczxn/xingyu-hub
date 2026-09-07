import { defineStore } from 'pinia'
import { ref } from 'vue'
import { configGroupApi } from '@/api/org'

/**
 * 站点配置 Store
 */
export const useSiteStore = defineStore('site', () => {
  // 站点名称
  const siteName = ref('星语管理端')
  // 站点描述
  const siteDescription = ref('星语社区运营管理后台')
  // 站点 Logo（默认展示星图品牌 emblem，后端可覆盖）
  const siteLogo = ref('/images/brand-constellation-logo.png')
  // 版权信息
  const copyright = ref('')
  // ICP 备案号
  const icp = ref('')
  // 水印配置
  const watermarkEnabled = ref(true)
  const watermarkType = ref('username')
  const watermarkCustomText = ref('')
  const watermarkOpacity = ref(0.1)
  // 安全配置
  const disableDevtool = ref(false)
  // 是否已加载
  const loaded = ref(false)

  /**
   * 加载站点配置
   */
  async function loadConfig() {
    try {
      const config = await configGroupApi.getPublicConfig()
      if (config.system) {
        siteName.value = config.system.siteName || '星语管理端'
        siteDescription.value = config.system.siteDescription || '星语社区运营管理后台'
        siteLogo.value = config.system.siteLogo || ''
        copyright.value = config.system.copyright || ''
        icp.value = config.system.icp || ''
        // 水印配置，默认开启
        watermarkEnabled.value = config.system.watermarkEnabled !== false
        watermarkType.value = config.system.watermarkType || 'username'
        watermarkCustomText.value = config.system.watermarkCustomText || ''
        watermarkOpacity.value = config.system.watermarkOpacity || 0.1
      }
      // 安全配置
      if (config.security) {
        disableDevtool.value = config.security.disableDevtool || false
      }
      loaded.value = true
    } catch (error) {
      console.error('加载站点配置失败', error)
    }
  }

  return {
    siteName,
    siteDescription,
    siteLogo,
    copyright,
    icp,
    watermarkEnabled,
    watermarkType,
    watermarkCustomText,
    watermarkOpacity,
    disableDevtool,
    loaded,
    loadConfig
  }
})
