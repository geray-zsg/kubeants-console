import request from '@/utils/request'

export function getServices(wsName, nsName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/services`,
    method: 'get'
  })
}

export function getServicesDetail(wsName, nsName, svcName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/services/${svcName}`,
    method: 'get'
  })
}

export function createServices(wsName, nsName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/services`,
    method: 'post',
    data: payload
  })
}

export function updateServices(wsName, nsName, svcName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/services/${svcName}`,
    method: 'put',
    data: payload
  })
}

export function deleteServices(wsName, nsName, svcName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/services/${svcName}`,
    method: 'delete'
  })
}
