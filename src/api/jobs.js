import request from '@/utils/request'

export function getJobs(wsName, nsName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/batch/v1/namespaces/${nsName}/jobs`,
    method: 'get'
  })
}

export function getJobsDetail(wsName, nsName, jobName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/batch/v1/namespaces/${nsName}/jobs/${jobName}`,
    method: 'get'
  })
}

export function createJobs(wsName, nsName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/batch/v1/namespaces/${nsName}/jobs`,
    method: 'post',
    data: payload
  })
}

export function updateJobs(wsName, nsName, jobName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/batch/v1/namespaces/${nsName}/jobs/${jobName}`,
    method: 'put',
    data: payload
  })
}

export function deleteJobs(wsName, nsName, jobName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/batch/v1/namespaces/${nsName}/jobs/${jobName}`,
    method: 'delete'
  })
}
