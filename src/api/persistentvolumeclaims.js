import request from '@/utils/request'

export function getPersistentVolumeClaims(wsName, nsName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/persistentvolumeclaims`,
    method: 'get'
  })
}

export function getPersistentVolumeClaimsDetaile(wsName, nsName, pvcName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/persistentvolumeclaims/${pvcName}`,
    method: 'get'
  })
}
export function createPersistentVolumeClaims(wsName, nsName, pvcName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/persistentvolumeclaims/${pvcName}`,
    method: 'post',
    data: payload
  })
}

export function updatePersistentVolumeClaims(wsName, nsName, pvcName, payload) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/persistentvolumeclaims/${pvcName}`,
    method: 'put',
    data: payload
  })
}

export function deletePersistentVolumeClaims(wsName, nsName, pvcName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/namespaces/${nsName}/persistentvolumeclaims/${pvcName}`,
    method: 'delete'
  })
}
