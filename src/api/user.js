import request from '@/utils/request'

export function login(data) {
  return request({
    url: '/gapi/login',
    method: 'post',
    data
  })
}

export function getInfo( username ) {

  // 构造请求 URL
  const url = `/gapi/cluster/test/workspace/test/apis/user.kubeants.io/v1beta1/users/${username}`

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
