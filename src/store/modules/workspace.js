import {
  listNamespaces,
  createNamespace,
  deleteNamespace,
  listUserBindings,
  createUserBinding,
  deleteUserBinding,
  userListAll
} from '@/api/workspace'

const state = {
  namespaces: [],
  userBindings: [],
  users: []
}

const mutations = {
  SET_NAMESPACES(state, data) {
    state.namespaces = data
  },
  SET_USER_BINDINGS(state, data) {
    state.userBindings = data
  },
  SET_USERS(state, data) {
    state.users = data
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
  async deleteNamespace(_, { name }) {
    return deleteNamespace(name)
  },
  async addUserBinding(_, { workspaceName, data }) {
    return createUserBinding(workspaceName, data)
  },
  async removeUserBinding(_, { workspaceName, name }) {
    console.log('移除成功,收到的信息是', workspaceName, name)
    return deleteUserBinding(workspaceName, name)
  },

  // 邀请用户时展示的用户列表
  async userListAll() {
    return userListAll()
  }
}

const getters = {
  namespaces: state => state.namespaces,
  userBindings: state => state.userBindings,
  users: state => state.users
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
