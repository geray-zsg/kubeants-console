// src/api/dashboard.js
import request from '@/utils/request'

// 获取用户workspace列表
export function getWorkspaces(username) {
  return request({
    url: `/gapi/cluster/test/workspace/ws1/apis/userbinding.kubeants.io/v1beta1/userbindings`, // 无斜杠结尾
    method: 'get',
    params: { labelSelector: `kubeants.io/user=${username}` }
  })
}
