// src/api/dashboard.js
import request from '@/utils/request'
// 查看 workspace 详情
export function getWorkspaceDetail(name) {
  return request({
    url: `/gapi/cluster/ka/workspace/wspublic/apis/workspace.kubeants.io/v1beta1/workspaces/${name}`,
    method: 'get'
  })
}

// 更新 workspace（只修改 annotation）
export function updateWorkspace(name, patchData) {
  return request({
    url: `/gapi/cluster/ka/workspace/wspublic/apis/workspace.kubeants.io/v1beta1/workspaces/${name}`,
    method: 'patch',
    headers: {
      'Content-Type': 'application/merge-patch+json'
    },
    data: patchData
  })
}

// 删除 workspace
export function deleteWorkspace(name) {
  return request({
    url: `/gapi/cluster/ka/workspace/wspublic/apis/workspace.kubeants.io/v1beta1/workspaces/${name}`,
    method: 'delete'
  })
}

// 新增创建Workspace接口
export function createWorkspace(payload) {
  console.log('正在发送创建Workspace请求:', payload)
  return request({
    url: '/gapi/cluster/ka/workspace/wspublic/apis/workspace.kubeants.io/v1beta1/workspaces',
    method: 'post',
    data: payload
    // headers: {
    //   'Content-Type': 'application/json'
    // }
  })
}
// 检查workspace名称
export function checkWorkspaceExists(name) {
  return request({
    url: `/gapi/cluster/ka/workspace/wspublic/apis/workspace.kubeants.io/v1beta1/workspaces/${name}`,
    method: 'head' // 使用HEAD方法只检查存在性
  })
}
// 获取用户workspace列表(除集群角色外)
export function getWorkspaces(username) {
  return request({
    url: `/gapi/cluster/ka/workspace/wspublic/apis/userbinding.kubeants.io/v1beta1/userbindings`,
    method: 'get',
    params: { labelSelector: `kubeants.io/user=${username}` }
  })
}
// 获取用户workspace列表(集群角色外)
export function getWorkspacesAll() {
  return request({
    url: `/gapi/cluster/ka/workspace/wspublic/apis/workspace.kubeants.io/v1beta1/workspaces`,
    method: 'get'
  })
}

// 获取用户列表(除集群角色外，根据workspace获取)
export function getUserAll() {
  return request({
    url: `/gapi/cluster/ka/workspace/wspublic/apis/user.kubeants.io/v1beta1/users`,
    method: 'get'
  })
}

// 查看用户详情
export function getUserDetail(username) {
  return request({
    url: `/gapi/cluster/ka/workspace/wspublic/apis/user.kubeants.io/v1beta1/users/${username}`,
    method: 'get'
  })
}

// 创建user
export function createUser(payload) {
  console.log('正在发送创建user请求:', payload)
  return request({
    url: `/gapi/cluster/ka/workspace/wspublic/apis/user.kubeants.io/v1beta1/users`,
    method: 'post',
    data: payload
  })
}

// 创建userbinding
export function createUserBinding(payload) {
  console.log('正在发送创建userbinding请求:', payload)
  return request({
    url: `/gapi/cluster/ka/workspace/wspublic/apis/userbinding.kubeants.io/v1beta1/userbindings`,
    method: 'post',
    data: payload
  })
}
// 删除 userbinding
export function deleteUserBinding(name) {
  return request({
    url: `/gapi/cluster/ka/workspace/wspublic/apis/userbinding.kubeants.io/v1beta1/userbindings/${name}`,
    method: 'delete'
  })
}

// 获取userbinding
export function getUserBindings(username) {
  console.log('正在发送获取userbinding请求:', username)
  return request({
    url: `/gapi/cluster/ka/workspace/wspublic/apis/userbinding.kubeants.io/v1beta1/userbindings`,
    method: 'get',
    params: { labelSelector: `kubeants.io/user=${username}` }
  })
}

// 编辑用户（PATCH 更新）
export function updateUser(name, patchData) {
  return request({
    url: `/gapi/cluster/ka/workspace/wspublic/apis/user.kubeants.io/v1beta1/users/${name}`,
    method: 'patch',
    headers: {
      'Content-Type': 'application/merge-patch+json'
    },
    data: patchData
  })
}

// 删除用户
export function deleteUser(name) {
  return request({
    url: `/gapi/cluster/ka/workspace/wspublic/apis/user.kubeants.io/v1beta1/users/${name}`,
    method: 'delete'
  })
}
