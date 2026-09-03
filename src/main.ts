import { createApp as createVueApp, createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import persist from 'pinia-plugin-persistedstate'

import App from './App.vue'
import AssistantPet from './components/assistant-pet.vue'

const mountAssistantPetForH5 = (pinia: ReturnType<typeof createPinia>) => {
  // App.vue 在 uni-app 中没有页面模板，H5 端用独立挂载点保持客服跨页面存在。
  if (typeof document === 'undefined' || document.getElementById('mall-assistant-pet-host')) return
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => mountAssistantPetForH5(pinia), { once: true })
    return
  }
  const host = document.createElement('div')
  host.id = 'mall-assistant-pet-host'
  document.body.appendChild(host)
  const assistantApp = createVueApp(AssistantPet)
  assistantApp.use(pinia)
  assistantApp.mount(host)
}

export function createApp() {
  // 创建 Vue 应用
  const app = createSSRApp(App)
  // 创建 Pinia
  const pinia = createPinia()
  // 使用 Pinia 持久化插件
  pinia.use(persist)
  // 使用 Pinia 插件
  app.use(pinia)

  // #ifdef H5
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => mountAssistantPetForH5(pinia), { once: true })
    } else {
      setTimeout(() => mountAssistantPetForH5(pinia), 0)
    }
  }
  // #endif

  return {
    app,
  }
}
