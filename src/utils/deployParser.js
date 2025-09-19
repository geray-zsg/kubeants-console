// /utils/deployParser.js
/**
 * 安全解析 容器 YAML 并转换为 createForm 表单结构
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

/**
 * 安全解析 deployment YAML 并转换为 createForm 表单结构
 * @param {Object} parsed - 通过 yaml.load() 解析出来的对象
 * @returns {Object} 返回完整的 createForm 对象
 */
export function deploySafeParseForm(deployment) {
  if (!deployment) return {}

  return {
    metadata: {
      name: deployment.metadata?.name || '',
      namespace: deployment.metadata?.namespace || '',
      labels: { ...(deployment.metadata?.labels || {}) }
    },
    spec: {
      replicas: deployment.spec?.replicas || 1,
      selector: {
        matchLabels: { ...(deployment.spec?.selector?.matchLabels || {}) }
      },
      template: {
        metadata: {
          labels: { ...(deployment.spec?.template?.metadata?.labels || {}) }
        },
        spec: {
          containers: [...(deployment.spec?.template?.spec?.containers || [])],
          initContainers: [...(deployment.spec?.template?.spec?.initContainers || [])],
          volumes: [...(deployment.spec?.template?.spec?.volumes || [])]
        }
      }
    }
  }
}

/**
 * 安全解析 StatefulSet YAML 并转换为 createForm 表单结构
 * @param {Object} statefulSet - StatefulSet 对象
 * @returns {Object} 返回完整的 createForm 对象
 */
export function stsSafeParseForm(statefulSet) {
  if (!statefulSet) return {}

  return {
    metadata: {
      name: statefulSet.metadata?.name || '',
      namespace: statefulSet.metadata?.namespace || '',
      labels: { ...(statefulSet.metadata?.labels || {}) }
    },
    spec: {
      replicas: statefulSet.spec?.replicas || 1,
      serviceName: statefulSet.spec?.serviceName || '',
      selector: {
        matchLabels: { ...(statefulSet.spec?.selector?.matchLabels || {}) }
      },
      template: {
        metadata: {
          labels: { ...(statefulSet.spec?.template?.metadata?.labels || {}) }
        },
        spec: {
          containers: [...(statefulSet.spec?.template?.spec?.containers || [])],
          initContainers: [...(statefulSet.spec?.template?.spec?.initContainers || [])],
          volumes: [...(statefulSet.spec?.template?.spec?.volumes || [])]
        }
      },
      volumeClaimTemplates: [...(statefulSet.spec?.volumeClaimTemplates || [])]
    }
  }
}
