import request from '@/utils/request'

export function getPod(wsName, nsName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/pods`,
    method: 'get'
  })
}

export function getPodDetaile(wsName, nsName, podName) {
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
