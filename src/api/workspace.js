import request from '@/utils/request'

// 获取指定Workspace下的Namespace列表
export function getNamespaces(workspaceName) {
  return request({
    url: `/gapi/cluster/test/workspace/${workspaceName}/api/v1/namespaces`,
    method: 'get',
    params: { labelSelector: `kubeants.io/workspace=${workspaceName}` }
  })
}

// 获取Workspace下的用户绑定列表
// export function getUserBindings(workspaceName) {
//   return request({
//     url: `/gapi/cluster/test/workspace/${workspaceName}/apis/userbinding.kubeants.io/v1beta1/userbindings`,
//     method: 'get',
//     params: { labelSelector: `kubeants.io/workspace=${workspaceName}` }
//   })
// }

// 新增：获取系统角色模板
export function getRoleTemplates() {
  return request({
    url: '/apis/rbac.kubeants.io/v1beta1/roletemplates',
    method: 'get'
  })
}

// 新增：更新用户绑定
export function updateUserBinding(name, payload) {
  return request({
    url: `/apis/userbinding.kubeants.io/v1beta1/userbindings/${name}`,
    method: 'put',
    data: payload
  })
}

// 新增：创建Namespace
export function createNamespace(workspaceName, payload) {
  console.log('正在发送创建Namespace请求:', workspaceName, payload)
  return request({
    url: `/gapi/cluster/ka/workspace/${workspaceName}/api/v1/namespaces`,
    method: 'post',
    data: payload
  })
}
