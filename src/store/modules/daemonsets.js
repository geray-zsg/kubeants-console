import {
  getDaemonsets,
  getDaemonsetsDetail,
  updateDaemonsets,
  createDaemonsets,
  deleteDaemonsets
} from '@/api/daemonsets'

const state = {
  daemonsets: []
}

const mutations = {
  SET_DS(state, data) {
    state.daemonsets = data
  }
}

const actions = {
  async getDaemonsets({ commit }, { wsName, nsName }) {
    const res = await getDaemonsets(wsName, nsName)
    const dsList = res.items?.items || []
    commit('SET_DS', dsList)
    return dsList
  },

  async getDaemonsetsDetail(_, { wsName, nsName, dsName }) {
    console.log('前端传递删除dsObj的wsName：', wsName, '获取的ns', nsName, 'dsObj名称：', dsName)
    const res = await getDaemonsetsDetail(wsName, nsName, dsName)
    return res
  },
  async createDaemonsets(_, { wsName, nsName, dsName, dsObj }) {
    const res = await createDaemonsets(wsName, nsName, dsName, dsObj)
    return res
  },
  async updateDaemonsets(_, { wsName, nsName, dsName, dsObj }) {
    const res = await updateDaemonsets(wsName, nsName, dsName, dsObj)
    return res
  },
  async deleteDaemonsets(_, { wsName, nsName, dsName }) {
    console.log('前端传递删除dsObj的wsName：', wsName, '获取的ns', nsName, 'dsObj名称：', dsName)
    const res = await deleteDaemonsets(wsName, nsName, dsName)
    return res
  }
}

const getters = {
  daemonsets: state => state.daemonsets
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
