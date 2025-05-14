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
