import {
  getConfigmap,
  getConfigmapDetail,
  createConfigmap,
  updateConfigmap,
  deleteConfigmap
} from '@/api/configmap'

const state = {
  cm: []
}

const mutations = {
  SET_CM(state, data) {
    state.cm = data
  }
}

const actions = {
  async getConfigmap({ commit }, { wsName, nsName }) {
    const res = await getConfigmap(wsName, nsName)
    // ✅ 正确获取嵌套数组
    commit('SET_CM', res.items?.items || [])
  },
  async getConfigmapDetail(_, { wsName, nsName, cmName }) {
    console.log('接收到的cmName是', cmName)
    const res = await getConfigmapDetail(wsName, nsName, cmName)
    return res // 直接返回对象
  },
  async createConfigmap(_, { wsName, nsName, configmap }) {
    return createConfigmap(wsName, nsName, configmap)
  },
  async updateConfigmap(_, { wsName, nsName, cmName, configmap }) {
    return updateConfigmap(wsName, nsName, cmName, configmap)
  },
  async deleteConfigmap(_, { wsName, nsName, cmName }) {
    return deleteConfigmap(wsName, nsName, cmName)
  }
}

const getters = {
  cm: state => state.cm
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
