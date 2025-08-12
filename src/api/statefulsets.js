import request from '@/utils/request'

export function getStatefulsets(wsName, nsName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/apps/v1/namespaces/${nsName}/statefulsets`,
    method: 'get'
  })
}

export function getStatefulsetsDetail(wsName, nsName, stsName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/apps/v1/namespaces/${nsName}/statefulsets/${stsName}`,
    method: 'get'
  })
}
export function createStatefulsets(wsName, nsName, stsName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/apps/v1/namespaces/${nsName}/statefulsets/${stsName}`,
    method: 'post',
    data: payload
  })
}

export function updateStatefulsets(wsName, nsName, stsName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/apps/v1/namespaces/${nsName}/statefulsets/${stsName}`,
    method: 'put',
    data: payload
  })
}

export function deleteStatefulsets(wsName, nsName, stsName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/apps/v1/namespaces/${nsName}/statefulsets/${stsName}`,
    method: 'delete'
  })
}
