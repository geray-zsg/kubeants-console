/**
 * 安全解析 sts YAML 并转换为 createForm 表单结构
 * @param {Object} parsed - 通过 yaml.load() 解析出来的对象
 * @returns {Object} 返回完整的 createForm 对象
 */
export function safeParseForm(parsed = {}) {
  const appName = parsed?.metadata?.name || ''
  const namespace = parsed?.metadata?.namespace || 'default'
  const replicas = parsed?.spec?.replicas || 1
  const selector = parsed?.spec?.selector || { matchLabels: { app: appName }}
  const labels = parsed?.spec?.template?.metadata?.labels || { app: appName }
  const containers = parsed?.spec?.template?.spec?.containers || []

  return {
    metadata: {
      name: appName
    },
    spec: {
      replicas,
      selector,
      serviceName: parsed?.spec?.serviceName || appName,
      template: {
        metadata: {
          labels
        },
        spec: {
          containers: containers.length > 0 ? [{
            name: containers[0].name || 'main',
            image: containers[0].image || ''
          }] : []
        }
      }
    },
    namespace
  }
}

