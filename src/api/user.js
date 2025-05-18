// src/api/user.js
import request from '@/utils/request'

export function login(data) {
  return request({
    url: '/gapi/system/login',
    method: 'post',
    data
  })
}

export function getInfo(username) {
  // 构造请求 URL
  if (!username) {
    console.log('接口为传递用户数据从本地存储获取用户名')
    // return Promise.reject('未找到用户信息')
    username = localStorage.getItem('username')
  }
  if (!username) {
    return Promise.reject('未找到用户信息')
  }
  console.log('api username', username)
  const url = `/gapi/system/userinfo/${username}`

  // 打印调试信息
  console.log('Request URL:', url)

  return request({
    url,
    method: 'get'
  })
}

export function logout() {
  return request({
    url: '/vue-admin-template/user/logout',
    method: 'post'
  })
}

// 获取userbinding
export function getUserBindings(username) {
  if (!username) {
    console.log('getUserBindings接口为传递用户数据从本地存储获取用户名')
    username = localStorage.getItem('username')
  }
  if (!username) {
    return Promise.reject('未找到用户信息')
  }

  console.log('username------------>', username)
  return request({
    url: `/gapi/cluster/test/workspace/ws1/apis/userbinding.kubeants.io/v1beta1/userbindings`,
    method: 'get',
    params: { labelSelector: `kubeants.io/user=${username}` }
  })
}
