import request from '@/utils/request'

export function getCronjobs(wsName, nsName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/batch/v1/namespaces/${nsName}/cronjobs`,
    method: 'get'
  })
}

export function getCronjobsDetail(wsName, nsName, cjName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/batch/v1/namespaces/${nsName}/cronjobs/${cjName}`,
    method: 'get'
  })
}

export function createCronjobs(wsName, nsName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/batch/v1/namespaces/${nsName}/cronjobs`,
    method: 'post',
    data: payload
  })
}

export function updateCronjobs(wsName, nsName, cjName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/batch/v1/namespaces/${nsName}/cronjobs/${cjName}`,
    method: 'put',
    data: payload
  })
}

export function deleteCronjobs(wsName, nsName, cjName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/batch/v1/namespaces/${nsName}/cronjobs/${cjName}`,
    method: 'delete'
  })
}
