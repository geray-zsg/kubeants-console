import {
  getPod,
  getPodDetaile,
  updatePod,
  createPod,
  deletePod
} from '@/api/pods'

const state = {
  pods: []
}

const mutations = {
  SET_PODS(state, data) {
    state.pods = data
  }
}

const actions = {
  async getPod({ commit }, { wsName, nsName }) {
    const res = await getPod(wsName, nsName)
    commit('SET_PODS', res.items)
  },

  async getPodDetaile(_, { wsName, nsName, podName }) {
    const res = await getPodDetaile(wsName, nsName, podName)
    return res
  },
  async createPod(_, { wsName, nsName, podName, pvc }) {
    const res = await createPod(wsName, nsName, podName, pvc)
    return res
  },
  async updatePod(_, { wsName, nsName, podName, pvc }) {
    const res = await updatePod(wsName, nsName, podName, pvc)
    return res
  },
  async deletePod(_, { wsName, nsName, podName }) {
    console.log('前端传递删除pvc的wsName：', wsName, '获取的ns', nsName, 'pvc名称：', podName)
    const res = await deletePod(wsName, nsName, podName)
    return res
  }
}

const getters = {
  pods: state => state.pods
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
