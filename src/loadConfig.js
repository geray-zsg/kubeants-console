// src/loadConfig.js
export async function loadConfig() {
  try {
    const res = await fetch('./config.json')
    const json = await res.json()
    window._env_ = json
  } catch (e) {
    console.warn('config.json 加载失败，使用默认配置', e)
    window._env_ = {}
  }
}
