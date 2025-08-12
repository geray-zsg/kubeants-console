import request from '@/utils/request'

export function getDaemonsets(wsName, nsName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/apps/v1/namespaces/${nsName}/daemonsets`,
    method: 'get'
  })
}

export function getDaemonsetsDetail(wsName, nsName, dsName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/apps/v1/namespaces/${nsName}/daemonsets/${dsName}`,
    method: 'get'
  })
}
export function createDaemonsets(wsName, nsName, dsName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/apps/v1/namespaces/${nsName}/daemonsets/${dsName}`,
    method: 'post',
    data: payload
  })
}

export function updateDaemonsets(wsName, nsName, dsName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/apps/v1/namespaces/${nsName}/daemonsets/${dsName}`,
    method: 'put',
    data: payload
  })
}

export function deleteDaemonsets(wsName, nsName, dsName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/apps/v1/namespaces/${nsName}/daemonsets/${dsName}`,
    method: 'delete'
  })
}
