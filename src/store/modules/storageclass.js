import {
  getStorageclass,
  getStorageclassDetaile
} from '@/api/storageclass'

const state = {
  storageclass: []
}

const mutations = {
  SET_SC(state, data) {
    state.storageclass = data
  }
}

const actions = {
  async getStorageclass({ commit }, { wsName }) {
    const res = await getStorageclass(wsName)
    const scList = res.items?.items || []
    commit('SET_SC', scList)
    return scList
  },

  async getStorageclassDetaile(_, { wsName, scName }) {
    const res = await getStorageclassDetaile(wsName, scName)
    return res // 返回用于详情展示
  }
}

const getters = {
  storageclass: state => state.storageclass
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
