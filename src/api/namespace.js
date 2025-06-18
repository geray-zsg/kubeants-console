import request from '@/utils/request'

export function getNamespaceDetail(nsName) {
  return request({
    url: `/gapi/cluster/ka/api/v1/namespaces/${nsName}`,
    method: 'get'
  })
}

// 获取namespace下的pod数量、role、rolebinding、quota、userbinding等
export function getRoles(wsName, nsName) {
  return request({
    url: `/gapi/cluster/test/workspace/${wsName}/apis/rbac.authorization.k8s.io/v1/namespaces/${nsName}/roles`,
    method: 'get'
  })
}

export function getQuota(wsName, nsName) {
  return request({
    url: `/gapi/cluster/test/workspace/${wsName}/api/v1/namespaces/${nsName}/resourcequotas`,
    method: 'get'
  })
}

export function getServiceAccount(wsName, nsName) {
  return request({
    url: `/gapi/cluster/test/workspace/${wsName}/api/v1/namespaces/${nsName}/serviceaccounts`,
    method: 'get'
  })
}
