import request from '@/utils/request'

export function getDeployment(wsName, nsName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/apps/v1/namespaces/${nsName}/deployments`,
    method: 'get'
  })
}

export function getDeploymentDetail(wsName, nsName, deployName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/apps/v1/namespaces/${nsName}/deployments/${deployName}`,
    method: 'get'
  })
}
export function createDeployment(wsName, nsName, deployName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/apps/v1/namespaces/${nsName}/deployments/${deployName}`,
    method: 'post',
    data: payload
  })
}

export function updateDeployment(wsName, nsName, deployName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/apps/v1/namespaces/${nsName}/deployments/${deployName}`,
    method: 'put',
    data: payload
  })
}

export function deleteDeployment(wsName, nsName, deployName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/apps/v1/namespaces/${nsName}/deployments/${deployName}`,
    method: 'delete'
  })
}
