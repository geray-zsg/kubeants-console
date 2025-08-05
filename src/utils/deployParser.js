/**
 * 安全解析 Deployment YAML 并转换为 createForm 表单结构
 * @param {Object} parsed - 通过 yaml.load() 解析出来的对象
 * @returns {Object} 返回完整的 createForm 对象
 */
export function safeParseForm(parsed = {}) {
  const appName = parsed?.metadata?.name || ''
  const namespace = parsed?.metadata?.namespace || 'default'
  const replicas = parsed?.spec?.replicas || 1
  const selector = parsed?.spec?.selector || { matchLabels: { app: appName }}
  const labels = parsed?.spec?.template?.metadata?.labels || { app: appName }

  return {
    metadata: {
      name: appName
    },
    spec: {
      replicas,
      selector,
      template: {
        metadata: {
          labels
        }
      }
    },
    namespace // 如果你希望在外部赋值 selectedNamespace，可以返回它
  }
}
