import request from '@/utils/request'

export function listNamespaces(workspaceName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${workspaceName}/api/v1/namespaces`,
    method: 'get',
    params: { labelSelector: `kubeants.io/workspace=${workspaceName}` }
  })
}

export function createNamespace(workspaceName, data) {
  return request({
    url: `/gapi/cluster/ka/workspace/${workspaceName}/api/v1/namespaces`,
    method: 'post',
    data
  })
}

export function deleteNamespace(name) {
  return request({
    url: `/gapi/cluster/ka/api/v1/namespaces/${name}`,
    method: 'delete'
  })
}

export function listUserBindings(workspaceName) {
  return request({
    url: `/gapi/cluster/ka/workspace/${workspaceName}/apis/userbinding.kubeants.io/v1beta1/userbindings`,
    method: 'get',
    params: { labelSelector: `kubeants.io/workspace=${workspaceName}` }
  })
}

export function createUserBinding(workspaceName, data) {
  return request({
    url: `/gapi/cluster/ka/workspace/${workspaceName}/apis/userbinding.kubeants.io/v1beta1/userbindings`,
    method: 'post',
    data
  })
}

export function deleteUserBinding(workspaceName, name) {
  return request({
    url: `/gapi/cluster/ka/workspace/${workspaceName}/apis/userbinding.kubeants.io/v1beta1/userbindings/${name}`,
    method: 'delete'
  })
}

export function userListAll() {
  return request({
    url: `/gapi/cluster/ka/workspace/wspublic/apis/user.kubeants.io/v1beta1/users`,
    method: 'get'
  })
}
