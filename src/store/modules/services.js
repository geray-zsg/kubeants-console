import {
  getServices,
  getServicesDetail,
  createServices,
  updateServices,
  deleteServices
} from '@/api/services'

const state = {
  services: []
}

const mutations = {
  SET_SVC(state, data) {
    state.services = data
  }
}

const actions = {
  async getServices({ commit }, { wsName, nsName }) {
    const res = await getServices(wsName, nsName)
    // ✅ 正确获取嵌套数组
    const svcList = res.items?.items || []
    commit('SET_SVC', svcList)
    return svcList
  },
  async getServicesDetail(_, { wsName, nsName, svcName }) {
    console.log('接收到的svcName是', svcName)
    const res = await getServicesDetail(wsName, nsName, svcName)
    return res // 直接返回对象
  },
  async createServices(_, { wsName, nsName, svcObj }) {
    return createServices(wsName, nsName, svcObj)
  },
  async updateServices(_, { wsName, nsName, svcName, svcObj }) {
    return updateServices(wsName, nsName, svcName, svcObj)
  },
  async deleteServices(_, { wsName, nsName, svcName }) {
    return deleteServices(wsName, nsName, svcName)
  }
}

const getters = {
  services: state => state.services
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
