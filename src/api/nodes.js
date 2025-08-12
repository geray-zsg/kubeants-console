import request from '@/utils/request'

export function getNodes(clusterName) {
  return request({
    url: `/gapi/cluster/local/api/v1/nodes`,
    method: 'get'
  })
}

export function getNodesDetail(clusterName, nodeName) {
  return request({
    url: `/gapi/cluster/local/api/v1/nodes/${nodeName}`,
    method: 'get'
  })
}

export function updateNodes(clusterName, nodeName, payload) {
  return request({
    url: `/gapi/cluster/local/api/v1/nodes/${nodeName}`,
    method: 'put',
    data: payload
  })
}
