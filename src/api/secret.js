import request from '@/utils/request'

export function getSecrets(wsName, nsName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/secrets`,
    method: 'get'
  })
}

export function getSecretDetail(wsName, nsName, secretName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/secrets/${secretName}`,
    method: 'get'
  })
}

export function createSecret(wsName, nsName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/secrets`,
    method: 'post',
    data: payload
  })
}

export function updateSecret(wsName, nsName, secretName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/secrets/${secretName}`,
    method: 'put',
    data: payload
  })
}

export function deleteSecret(wsName, nsName, secretName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/secrets/${secretName}`,
    method: 'delete'
  })
}
