import { getWorkspaces } from '@/api/dashboard'

const state = {
  workspaces: []
}

const mutations = {
  SET_WORKSPACES(state, data) {
    console.log('原始数据:', data.items)
    // 过滤并格式化有效工作空间
    state.workspaces = data.items
      .filter(item => item.spec?.scope?.kind === 'Workspace')
      .map(item => ({
        name: item.spec.scope.name,
        role: item.spec.role
        // raw: item // 保留原始数据
      }))
  }
}

const actions = {
  async getWorkspaces({ commit, rootState }, username) {
    try {
      // 从rootState获取用户名（更可靠的方式）
      const realUsername = username || localStorage.getItem('username')

      console.log('realUsername', realUsername)
      // 调用api的getWorkspaces
      const respData = await getWorkspaces(realUsername)
      console.log('username realUsername:', realUsername)
      console.log('respData', respData)
      console.log('name---> role', respData.items[0].spec.scope.name, respData.items[0].spec.role)
      commit('SET_WORKSPACES', respData)
      return respData // 返回数据供可能需要的链式调用
    } catch (error) {
      console.error('[Store] 加载工作空间失败:', error)
      throw error
    }
  }
}

const getters = {
  workspaces: state => state.workspaces
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
