// src/api/persistentvolumes.js
import request from '@/utils/request'

export function getPersistentvolumes(wsName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/persistentvolumes`,
    method: 'get'
  })
}

export function getPersistentvolumesDetaile(wsName, pvName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${wsName}/api/v1/persistentvolumes/${pvName}`,
    method: 'get'
  })
}
