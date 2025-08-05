import request from '@/utils/request'
// import { getToken } from '@/utils/auth' // get token from cookie

export function getPod(wsName, nsName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/pods`,
    method: 'get'
  })
}

export function getPodDetail(wsName, nsName, podName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/pods/${podName}`,
    method: 'get'
  })
}
export function createPod(wsName, nsName, podName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/pods/${podName}`,
    method: 'post',
    data: payload
  })
}

export function updatePod(wsName, nsName, podName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/pods/${podName}`,
    method: 'put',
    data: payload
  })
}

export function deletePod(wsName, nsName, podName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/pods/${podName}`,
    method: 'delete'
  })
}

export function getPodLogs({ wsName, nsName, podName, container, tailLines = 1000 }) {
  return request({
    url: `/gapi/cluster/local/workspace/${wsName}/api/v1/namespaces/${nsName}/pod/${podName}/log`,
    method: 'get',
    params: { container, tailLines, follow: false }
  })
}

export function downloadPodLogs({ wsName, nsName, podName, container, tailLines = 100000 }) {
  return request({
    url: `/gapi/cluster/local/workspace/${wsName}/api/v1/namespaces/${nsName}/pod/${podName}/log`,
    method: 'get',
    params: {
      container,
      tailLines,
      follow: false,
      download: true
    },
    responseType: 'blob' // 👈 重点：以 blob 返回
  }).then(blob => {
    // 创建 Blob 对象并下载
    const url = window.URL.createObjectURL(new Blob([blob]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${podName}.log`) // 文件名
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  })
}

// export function generateExecWsUrl({ wsName, nsName, podName, container }) {
//   const base = location.origin.replace(/^http/, 'ws') // 自动获取并替换协议
//   const token = getToken()

//   return `${base}/gapi/cluster/local/workspace/${wsName}/api/v1/namespaces/${nsName}/pods/${podName}/exec?container=${container}&command=/bin/sh&authorization=Bearer ${token}`
// }
