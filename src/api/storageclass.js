import request from '@/utils/request'

export function getStorageclass(wsName, scName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/storage.k8s.io/v1/storageclasses`,
    method: 'get'
  })
}

export function getStorageclassDetaile(wsName, scName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/apis/storage.k8s.io/v1/storageclasses/${scName}`,
    method: 'get'
  })
}
