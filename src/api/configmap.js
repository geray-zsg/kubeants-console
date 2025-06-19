import request from '@/utils/request'

export function getConfigmap(wsName, nsName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/configmaps`,
    method: 'get'
  })
}

export function getConfigmapDetail(wsName, nsName, cmName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/configmaps/${cmName}`,
    method: 'get'
  })
}

export function createConfigmap(wsName, nsName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/configmaps`,
    method: 'post',
    data: payload
  })
}

export function updateConfigmap(wsName, nsName, data) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/configmaps`,
    method: 'get'
  })
}

export function deleteConfigmap(wsName, nsName, cmName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/configmaps/${cmName}`,
    method: 'delete'
  })
}
