import {
  getNamespaceDetail,
  getRoles,
  getQuota,
  getServiceAccount
} from '@/api/namespace'

const state = {
  ns: [],
  serviceaccounts: [],
  roles: [],
  quotas: []
}

const mutations = {
  SET_NS(state, data) {
    state.ns = data
  },
  SET_ROLES(state, data) {
    state.roles = data
  },
  SET_QUOTAS(state, data) {
    state.quotas = data
  },
  SET_SERVICEACCOUNTS(state, data) {
    state.serviceaccounts = data
  }
}

const actions = {
  async getNamespaceDetail({ commit }, nsName) {
    console.log('传递的nsName是', nsName)
    const res = await getNamespaceDetail(nsName)
    commit('SET_NS', res || [])
  },
  async getRoles({ commit }, params) {
    const res = await getRoles(params.wsName, params.nsName)
    commit('SET_ROLES', res.items?.items || [])
  },

  async getQuota({ commit }, params) {
    const res = await getQuota(params.wsName, params.nsName)
    commit('SET_QUOTAS', res.items?.items || [])
  },

  async getServiceAccount({ commit }, params) {
    const res = await getServiceAccount(params.wsName, params.nsName)
    commit('SET_SERVICEACCOUNTS', res.items?.items || [])
  }
}

const getters = {
  ns: state => state.ns,
  roles: state => state.roles,
  quotas: state => state.quotas,
  serviceaccounts: state => state.serviceaccounts
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
