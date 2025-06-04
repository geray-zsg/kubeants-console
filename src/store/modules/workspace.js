import {
  listNamespaces,
  createNamespace,
  deleteNamespace,
  listUserBindings,
  createUserBinding,
  deleteUserBinding
} from '@/api/workspace'

const state = {
  namespaces: [],
  userBindings: []
}

const mutations = {
  SET_NAMESPACES(state, data) {
    state.namespaces = data
  },
  SET_USER_BINDINGS(state, data) {
    state.userBindings = data
  }
}

const actions = {
  async getNamespaces({ commit }, workspaceName) {
    const res = await listNamespaces(workspaceName)
    console.log('前端传递的workspaceName：', workspaceName, '获取的ns数据res.items', res.items)
    commit('SET_NAMESPACES', res.items || [])
  },
  async getUserBindings({ commit }, workspaceName) {
    const res = await listUserBindings(workspaceName)
    console.log('前端传递的workspaceName：', workspaceName, '获取的usb数据res.items', res.items)
    commit('SET_USER_BINDINGS', res.items || [])
  },
  async addNamespace(_, { workspaceName, data }) {
    return createNamespace(workspaceName, data)
  },
  async removeNamespace(_, { workspaceName, name }) {
    return deleteNamespace(workspaceName, name)
  },
  async addUserBinding(_, { workspaceName, data }) {
    return createUserBinding(workspaceName, data)
  },
  async removeUserBinding(_, { workspaceName, name }) {
    return deleteUserBinding(workspaceName, name)
  }
}

const getters = {
  namespaces: state => state.namespaces,
  userBindings: state => state.userBindings
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
