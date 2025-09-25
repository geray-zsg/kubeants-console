/**
 * 安全解析 Job YAML 并转换为 createForm 表单结构
 * @param {Object} parsed - 通过 yaml.load() 解析出来的 Job 对象
 * @returns {Object} 返回完整的 createForm 对象
 */
export function safeParseJobForm(parsed = {}) {
  const jobName = parsed?.metadata?.name || ''
  const namespace = parsed?.metadata?.namespace || ''

  // 提取 Job 的 spec 配置
  const completions = parsed?.spec?.completions || 1
  const parallelism = parsed?.spec?.parallelism || 1
  const backoffLimit = parsed?.spec?.backoffLimit || 6
  const activeDeadlineSeconds = parsed?.spec?.activeDeadlineSeconds || null
  const selector = parsed?.spec?.selector || null // 保留 selector

  // 提取标签
  const labels = parsed?.metadata?.labels || {}
  const templateLabels = parsed?.spec?.template?.metadata?.labels || {}

  // 提取容器信息
  const containers = parsed?.spec?.template?.spec?.containers || []
  const restartPolicy = parsed?.spec?.template?.spec?.restartPolicy || 'OnFailure'

  return {
    metadata: {
      name: jobName,
      namespace: namespace,
      labels: labels
    },
    spec: {
      completions,
      parallelism,
      backoffLimit,
      activeDeadlineSeconds,
      selector, // 保留 selector
      template: {
        metadata: {
          labels: templateLabels
        },
        spec: {
          restartPolicy,
          containers: containers.map(container => ({
            name: container.name || '',
            image: container.image || '',
            ports: container.ports || [],
            resources: container.resources || {
              requests: { cpu: '100m', memory: '128Mi' },
              limits: { cpu: '500m', memory: '512Mi' }
            },
            imagePullPolicy: container.imagePullPolicy || 'IfNotPresent',
            command: container.command || '',
            args: container.args || '',
            volumeMounts: container.volumeMounts || []
          }))
        }
      }
    }
  }
}
