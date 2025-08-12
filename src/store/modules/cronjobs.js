import {
  getCronjobs,
  getCronjobsDetail,
  createCronjobs,
  updateCronjobs,
  deleteCronjobs
} from '@/api/cronjobs'

const state = {
  cronjobs: []
}

const mutations = {
  SET_CJ(state, data) {
    state.cronjobs = data
  }
}

const actions = {
  async getCronjobs({ commit }, { wsName, nsName }) {
    const res = await getCronjobs(wsName, nsName)
    // ✅ 正确获取嵌套数组
    const jobList = res.items?.items || []
    commit('SET_CJ', jobList)
    return jobList
  },
  async getCronjobsDetail(_, { wsName, nsName, cjName }) {
    console.log('接收到的cjName是', cjName)
    const res = await getCronjobsDetail(wsName, nsName, cjName)
    return res // 直接返回对象
  },
  async createCronjobs(_, { wsName, nsName, cjObj }) {
    return createCronjobs(wsName, nsName, cjObj)
  },
  async updateCronjobs(_, { wsName, nsName, cjName, cjObj }) {
    return updateCronjobs(wsName, nsName, cjName, cjObj)
  },
  async deleteCronjobs(_, { wsName, nsName, cjName }) {
    return deleteCronjobs(wsName, nsName, cjName)
  }
}

const getters = {
  cronjobs: state => state.cronjobs
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
