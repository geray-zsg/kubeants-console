import {
  getPod,
  getPodDetail,
  updatePod,
  createPod,
  deletePod,
  getPodLogs,
  downloadPodLogs
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

  async getPodDetail(_, { wsName, nsName, podName }) {
    const res = await getPodDetail(wsName, nsName, podName)
    return res
  },
  async createPod(_, { wsName, nsName, podName, pod }) {
    const res = await createPod(wsName, nsName, podName, pod)
    return res
  },
  async updatePod(_, { wsName, nsName, podName, pod }) {
    const res = await updatePod(wsName, nsName, podName, pod)
    return res
  },
  async deletePod(_, { wsName, nsName, podName }) {
    console.log('前端传递删除pod的wsName：', wsName, '获取的ns', nsName, 'pod名称：', podName)
    const res = await deletePod(wsName, nsName, podName)
    return res
  },
  async getPodLogs(_, payload) {
    return await getPodLogs(payload)
  },
  downloadPodLogs(_, payload) {
    downloadPodLogs(payload)
  }
  // generateExecWsUrl(_, payload) {
  //   return generateExecWsUrl(payload)
  // }
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
