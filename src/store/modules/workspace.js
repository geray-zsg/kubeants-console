import { getNamespaces, getRoleTemplates, createNamespace } from '@/api/workspace'

const state = {
  namespaces: [],
  userBindings: [],
  roleTemplates: [] // 新增角色模板存储
}

const mutations = {
  SET_NAMESPACES(state, data) {
    state.namespaces = data.items.map(ns => ({
      name: ns.metadata.name,
      labels: ns.metadata.labels || {}
    }))
  },
  SET_USER_BINDINGS(state, data) {
    state.userBindings = data.items.map(ub => ({
      user: ub.spec.user,
      role: ub.spec.role,
      scope: ub.spec.scope
    }))
  },
  SET_ROLE_TEMPLATES(state, data) {
    state.roleTemplates = data.items.map(rt => ({
      name: rt.metadata.name,
      description: rt.spec.description
    }))
  }
}

const actions = {
  async fetchNamespaces({ commit }, workspaceName) {
    const res = await getNamespaces(workspaceName)
    commit('SET_NAMESPACES', res)
  },
  // async fetchUserBindings({ commit }, workspaceName) {
  //   const res = await getUserBindings(workspaceName)
  //   commit('SET_USER_BINDINGS', res)
  // },
  async fetchRoleTemplates({ commit }) {
    const res = await getRoleTemplates()
    commit('SET_ROLE_TEMPLATES', res)
  },
  // 新增：创建 Namespace
  async createNamespace(_, { workspace, namespace }) {
    return await createNamespace(workspace, namespace)
  }
}

const getters = {
  namespaces: state => state.namespaces,
  userBindings: state => state.userBindings,
  roleTemplates: state => state.roleTemplates
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
