/**
 * 安全解析 sts YAML 并转换为 createForm 表单结构
 * @param {Object} parsed - 通过 yaml.load() 解析出来的对象
 * @returns {Object} 返回完整的 createForm 对象
 */
export function safeParseCronJobForm(obj = {}) {
  return {
    metadata: obj.metadata || { name: '', namespace: '' },
    spec: {
      schedule: obj.spec?.schedule || '0 * * * *',
      concurrencyPolicy: obj.spec?.concurrencyPolicy || 'Allow',
      startingDeadlineSeconds: obj.spec?.startingDeadlineSeconds || null,
      successfulJobsHistoryLimit: obj.spec?.successfulJobsHistoryLimit || 3,
      failedJobsHistoryLimit: obj.spec?.failedJobsHistoryLimit || 1,
      suspend: obj.spec?.suspend || false,
      jobTemplate: {
        spec: {
          completions: obj.spec?.jobTemplate?.spec?.completions ?? 1,
          parallelism: obj.spec?.jobTemplate?.spec?.parallelism ?? 1,
          backoffLimit: obj.spec?.jobTemplate?.spec?.backoffLimit ?? 6,
          activeDeadlineSeconds: obj.spec?.jobTemplate?.spec?.activeDeadlineSeconds || null,
          template: {
            metadata: obj.spec?.jobTemplate?.spec?.template?.metadata || { labels: {}},
            spec: {
              restartPolicy: obj.spec?.jobTemplate?.spec?.template?.spec?.restartPolicy || 'OnFailure',
              containers: obj.spec?.jobTemplate?.spec?.template?.spec?.containers || [],
              initContainers: obj.spec?.jobTemplate?.spec?.template?.spec?.initContainers || [],
              volumes: obj.spec?.jobTemplate?.spec?.template?.spec?.volumes || []
            }
          }
        }
      }
    }
  }
}
